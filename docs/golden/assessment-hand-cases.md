# Assessment hand cases

Independent of app code (Python standard library only). Fixture vectors are arbitrary, not O*NET data.

```python
from statistics import pstdev, mean
K="RIASEC"
U=dict(zip(K,[10,5,38,30,20,8]))
V=dict(zip(K,[2.5,6.5,2.5,2.0,2.5,5.0]))
def z(p):
    m=mean(p.values()); s=pstdev(p.values())
    return {k:(p[k]-m)/s for k in K}
zu,zv=z(U),z(V)
c={k:zu[k]*zv[k] for k in K}
r=sum(c.values())/6
print("r",repr(r))
print("contrib",{k:round(v,6) for k,v in c.items()})
pos=sorted([k for k in K if c[k]>0],key=lambda k:-c[k])[:2]
neg=sorted([k for k in K if c[k]<0],key=lambda k:c[k])[:1]
print("shared",pos,"mismatch",neg)
print("fit",(1+r)/2)
```

Output:

```
r -0.7139019319481968
contrib {'R': 0.42336, 'I': -2.017188, 'A': -0.971239, 'S': -0.859173, 'E': -0.074711, 'C': -0.784462}
shared ['R'] mismatch ['I']
fit 0.14304903402590158
```
