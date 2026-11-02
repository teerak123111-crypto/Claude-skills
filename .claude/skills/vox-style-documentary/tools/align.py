"""Align the script (phrases separated by spaces, exactly as sent to the AI voice) to the speech chunks
found by tighten.py, by dynamic programming. No speech recognition needed (Thai digits are spelled out for the weights).
usage: align.py script.txt vo-tight-chunks.json words.json   -> [{w, start, end}] on the vo-tight timeline"""
import json, sys, unicodedata
txt, chunks_p, out = sys.argv[1:4]
ph = open(txt).read().split(); ch0 = json.load(open(chunks_p)); ch = []
for c in ch0:
    if ch and c['e'] - c['s'] < .2: ch[-1]['e'] = c['e']; ch[-1]['gap'] = c['gap']
    else: ch.append(dict(c))
D='ศูนย์ หนึ่ง สอง สาม สี่ ห้า หก เจ็ด แปด เก้า'.split()
def th(nm):
    n=int(nm); out=''
    for v,u in ((1000,'พัน'),(100,'ร้อย'),(10,'สิบ')):
        q,n=divmod(n,v)
        if q: out+=('' if (v==10 and q==1) else ('ยี่' if (v==10 and q==2) else D[q]))+u
    return out+(('เอ็ด' if out else 'หนึ่ง') if n==1 else (D[n] if n else ''))
import re
def w(s):
    s=re.sub(r'\d+',lambda m:th(m.group()),s); return sum(1 for c in s if unicodedata.category(c)[0] != 'M') + 1.5
L = [w(p) for p in ph]; n, m = len(ph), len(ch)
tot_speech = sum(c['e'] - c['s'] for c in ch); rate = tot_speech / sum(L)
import math
# state: (i phrases consumed, j chunks consumed) where phrase boundary i aligns with chunk boundary j
INF = 1e18; best = {(0, 0): (0.0, None)}
for i in range(n + 1):
    for j in range(m + 1):
        if (i, j) not in best: continue
        c0, _ = best[(i, j)]
        for di in range(1, 5):
            for dj in range(1, 5):
                i2, j2 = i + di, j + dj
                if i2 > n or j2 > m: continue
                sp = sum(ch[k]['e'] - ch[k]['s'] for k in range(j, j2)); want = rate * sum(L[i:i2])
                cost = ((sp - want) / (want + .3)) ** 2 * 10
                cost += sum(2.0 + ch[k]['gap'] * 6 for k in range(j, j2 - 1))   # internal pauses swallowed
                cost += (di - 1) * 1.0                                            # phrase boundaries w/o pause
                if (i2, j2) not in best or best[(i2, j2)][0] > c0 + cost: best[(i2, j2)] = (c0 + cost, (i, j))
st = (n, m); path = []
while st != (0, 0): path.append(st); st = best[st][1]
path.reverse(); res = []; prev = (0, 0)
for i2, j2 in path:
    i, j = prev; a, b = ch[j]['s'], ch[j2 - 1]['e']
    # within group, split time by char weight across speech only (approx)
    tot = sum(L[i:i2]); t = a
    for k in range(i, i2):
        d = (b - a) * L[k] / tot; res.append(dict(w=ph[k], start=round(t, 3), end=round(t + d, 3))); t += d
    prev = (i2, j2)
json.dump(res, open(out, 'w'), ensure_ascii=False, indent=0)
print(best[(n, m)][0]); [print(r['start'], r['end'], r['w']) for r in res]
