"""Make the opening voice lines on your own PC with Indic Parler-TTS (Apache 2.0).

Reads the spoken cues from data/story2.json (meta.opening[].audio with a "line"),
makes a few takes of each with a named speaker, and checks each take against the
cue's time limit. Then --finalize turns the takes you picked into the files the game
expects in app/audio/ (mono MP3, about -16 LUFS, trimmed silence).

The model is gated: log in to Hugging Face and accept its terms on
https://huggingface.co/ai4bharat/indic-parler-tts before the first run.

Setup (Windows, inside D:\\Projects\\NightOfLamps):
    python -m venv .venv
    .venv\\Scripts\\activate
    pip install torch soundfile
    pip install git+https://github.com/huggingface/parler-tts.git
    huggingface-cli login
    set HF_HOME=D:\\Projects\\NightOfLamps\\hf-cache      (keeps the 3.5 GB model on D:)

Make takes (from the repo folder, or pass --story):
    python app\\tools\\make_voices.py --narrator Thoma --jyo Mary --takes 3
    python app\\tools\\make_voices.py --dry-run          (list the lines, no model)

Finalize (needs ffmpeg on PATH). Picks take 1 unless you name others:
    python app\\tools\\make_voices.py --finalize --pick op1_l1=2 op3_l1=3
"""
import argparse, json, os, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))

STYLE = {
    'Narrator': "{v} speaks in a calm, warm and natural Indian English voice at a moderate pace, "
                "with a slightly low pitch. Very clear audio, close-sounding, no background noise.",
    'Jyo': "{v} speaks in a gentle, warm and slightly bright Indian English voice at a moderate pace, "
           "friendly and quietly curious, not childish. Very clear audio, close-sounding, no background noise.",
    'JyoCute': "{v} speaks in a high-pitched, bright and cheerful Indian English voice, slightly fast and very expressive, "
               "playful and full of wonder. Very clear audio, close-sounding, no background noise.",
}
AUDITION_VOICES = ['Mary', 'Sneha', 'Kavya', 'Tisha', 'Priya', 'Riya', 'Gauri', 'Nisha']


def load_cues(story):
    meta = json.load(open(story, encoding='utf-8'))['meta']
    cues = []
    for shot, s in enumerate(meta.get('opening', []), 1):
        for c in s.get('audio', []):
            if c.get('line'):
                cues.append(dict(c, shot=shot))
    return cues


def make_takes(cues, voices, takes, outdir, threads=0, fast=False, jyo_style='Jyo', audition=None):
    import time, torch, soundfile as sf
    from parler_tts import ParlerTTSForConditionalGeneration
    from transformers import AutoTokenizer
    device = 'cuda:0' if torch.cuda.is_available() else 'cpu'
    if device == 'cpu':
        torch.set_num_threads(threads or os.cpu_count() or 4)
    # bfloat16 is about 1.5-2x faster on CPUs that support it (Ryzen 7000/8000); the sound can differ slightly.
    dtype = torch.bfloat16 if fast else torch.float32
    print('Loading model on %s, %s, %d threads (first run downloads about 3.5 GB)...'
          % (device, 'bfloat16' if fast else 'float32', torch.get_num_threads()))
    name = 'ai4bharat/indic-parler-tts'
    try:
        model = ParlerTTSForConditionalGeneration.from_pretrained(name, attn_implementation='sdpa', torch_dtype=dtype).to(device)
    except (TypeError, ValueError):
        model = ParlerTTSForConditionalGeneration.from_pretrained(name, torch_dtype=dtype).to(device)
    t0 = time.time()
    tok = AutoTokenizer.from_pretrained(name)
    desc_tok = AutoTokenizer.from_pretrained(model.config.text_encoder._name_or_path)
    os.makedirs(outdir, exist_ok=True)
    report = []
    jobs = []   # (cue, take number, description, output file name)
    for c in cues:
        is_jyo = c.get('speaker') == 'Jyo'
        style = STYLE[jyo_style] if is_jyo else STYLE['Narrator']
        if audition:   # one take of each line per candidate voice, to compare voices quickly
            for v in audition:
                jobs.append((c, 1, style.format(v=v), '%s_%s.wav' % (c['id'], v)))
        else:
            v = voices['Jyo' if is_jyo else 'Narrator']
            for t in range(1, takes + 1):
                jobs.append((c, t, style.format(v=v), '%s_take%d.wav' % (c['id'], t)))
    for c, t, desc, fname in jobs:
        d = desc_tok(desc, return_tensors='pt').to(device)
        p = tok(c['line'], return_tensors='pt').to(device)
        torch.manual_seed(1000 * t + len(c['id']))
        gen = model.generate(input_ids=d.input_ids, attention_mask=d.attention_mask,
                             prompt_input_ids=p.input_ids, prompt_attention_mask=p.attention_mask)
        audio = gen.to(torch.float32).cpu().numpy().squeeze()
        path = os.path.join(outdir, fname)
        sf.write(path, audio, model.config.sampling_rate)
        secs = len(audio) / model.config.sampling_rate
        flag = 'OK' if secs <= c['max'] + 0.3 else 'LONG'
        report.append('%-24s %4.1fs (limit %.1fs) %s  %s' % (fname, secs, c['max'], flag, c['line']))
        print(report[-1], ' [%.0fs elapsed]' % (time.time() - t0))
    open(os.path.join(outdir, 'report.txt'), 'w', encoding='utf-8').write('\n'.join(report) + '\n')
    print('\nListen to the takes in', outdir, 'and pick one per line. LONG takes get sped up a little at finalize.')


def finalize(cues, picks, takesdir, audiodir, jyo_pitch=0.0):
    if not shutil.which('ffmpeg'):
        sys.exit('ffmpeg not found. Install it (for example: winget install ffmpeg) and try again.')
    os.makedirs(audiodir, exist_ok=True)
    for c in cues:
        pick = picks.get(c['id'], '1')   # a take number (2) or an audition voice name (Sneha)
        name = '%s_take%s.wav' % (c['id'], pick) if pick.isdigit() else '%s_%s.wav' % (c['id'], pick)
        src = os.path.join(takesdir, name)
        if not os.path.exists(src):
            print('skip', c['id'], '(no take found:', src + ')')
            continue
        dur = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                                             '-of', 'default=nw=1:nk=1', src]).decode().strip())
        trimmed = max(dur - 0.2, 0.1)   # rough allowance for trimmed silence
        tempo = min(max(trimmed / c['max'], 1.0), 1.25)
        sr = int(subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'a:0', '-show_entries',
                                          'stream=sample_rate', '-of', 'default=nw=1:nk=1', src]).decode().strip())
        # Pitch lift for Jyo: raise the pitch by N semitones without changing the speed.
        shift = 2 ** (jyo_pitch / 12.0) if (jyo_pitch and c.get('speaker') == 'Jyo') else 1.0
        pitch = 'asetrate=%d,aresample=%d,atempo=%.4f,' % (round(sr * shift), sr, 1 / shift) if shift != 1.0 else ''
        af = pitch + 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,' \
             'silenceremove=start_periods=1:start_threshold=-45dB,areverse,' \
             'atempo=%.3f,loudnorm=I=-16:TP=-1.5:LRA=7' % tempo
        dst = os.path.join(audiodir, os.path.basename(c['file']))
        subprocess.check_call(['ffmpeg', '-y', '-v', 'error', '-i', src, '-af', af,
                               '-ac', '1', '-ar', '48000', '-b:a', '64k', dst])
        print('wrote', dst, '(speed x%.2f)' % tempo if tempo > 1.0 else '')
    print('\nNext: python app\\build.py, then play the opening with the Sound button on.')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--story', default=os.path.join(ROOT, 'data', 'story2.json'))
    ap.add_argument('--narrator', default='Thoma', help='Indic Parler-TTS English speaker for the narrator')
    ap.add_argument('--jyo', default='Mary', help='Indic Parler-TTS English speaker for Jyo')
    ap.add_argument('--takes', type=int, default=3)
    ap.add_argument('--takes-dir', default=os.path.join(ROOT, 'app', 'audio_takes'))
    ap.add_argument('--audio-dir', default=os.path.join(ROOT, 'app', 'audio'))
    ap.add_argument('--only', nargs='*', help='cue ids to make, e.g. op3_l1 op3_l2')
    ap.add_argument('--cute', action='store_true', help="Jyo's lines: brighter, higher, cheerful style")
    ap.add_argument('--audition', nargs='*', help='make one take per voice for comparing; no names = 8 female English voices')
    ap.add_argument('--jyo-pitch', type=float, default=0.0, help='finalize: raise Jyo pitch by N semitones (try 2 to 4)')
    ap.add_argument('--threads', type=int, default=0, help='CPU threads (default: all)')
    ap.add_argument('--fast', action='store_true', help='bfloat16 on CPU: about 1.5-2x faster on Ryzen 7000/8000, sound can differ slightly')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--finalize', action='store_true')
    ap.add_argument('--pick', nargs='*', default=[], help='cue_id=take, e.g. op1_l1=2')
    a = ap.parse_args()
    cues = load_cues(a.story)
    if a.only:
        cues = [c for c in cues if c['id'] in a.only]
    if a.dry_run:
        for c in cues:
            print('%-8s shot %d  %-8s max %.1fs  %s' % (c['id'], c['shot'], c.get('speaker', ''), c['max'], c['line']))
        print(len(cues), 'spoken lines')
        return
    if a.finalize:
        picks = dict(p.split('=', 1) for p in a.pick)
        return finalize(cues, picks, a.takes_dir, a.audio_dir, a.jyo_pitch)
    audition = None if a.audition is None else (a.audition or AUDITION_VOICES)
    make_takes(cues, {'Narrator': a.narrator, 'Jyo': a.jyo}, a.takes, a.takes_dir, a.threads, a.fast,
               'JyoCute' if a.cute else 'Jyo', audition)


if __name__ == '__main__':
    main()
