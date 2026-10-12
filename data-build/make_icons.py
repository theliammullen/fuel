from PIL import Image, ImageDraw, ImageFilter
import math, os
OUT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','icons')
def grad_color(c1,c2,t): return tuple(int(c1[i]+(c2[i]-c1[i])*t) for i in range(3))
def make(size, maskable=False):
    S=1024
    img=Image.new('RGB',(S,S),(10,11,20))
    # background radial glow
    bg=Image.new('RGB',(S,S),(0,0,0)); d=ImageDraw.Draw(bg)
    for r in range(S,0,-8):
        t=r/S; c=grad_color((40,22,80),(9,10,18),t)
        d.ellipse([S*0.3-r,S*0.25-r,S*0.3+r,S*0.25+r],fill=c)
    img=bg
    scale=0.78 if maskable else 1.0
    cx=cy=S/2
    rings=[(380,((255,94,128),(255,170,64))),(290,((64,224,160),(32,200,255))),(200,((140,110,255),(90,180,255)))]
    fracs=[0.82,0.68,0.9]
    for (R,(c1,c2)),fr in zip(rings,fracs):
        R*=scale; w=62*scale
        # track
        tr=Image.new('L',(S,S),0); td=ImageDraw.Draw(tr)
        td.ellipse([cx-R,cy-R,cx+R,cy+R],outline=255,width=int(w))
        img.paste((255,255,255),(0,0),tr.point(lambda v:int(v*0.08)))
        # gradient arc made of segments
        steps=360
        lay=Image.new('RGBA',(S,S),(0,0,0,0)); ld=ImageDraw.Draw(lay)
        for i in range(int(steps*fr)):
            a0=-90+i*360/steps; a1=a0+360/steps+0.8
            col=grad_color(c1,c2,i/(steps*fr))
            ld.arc([cx-R+w/2-w/2,cy-R+w/2-w/2,cx+R,cy+R],a0,a1,fill=col+(255,),width=int(w))
        # round caps
        for ang,col in ((-90,c1),(-90+360*fr,c2)):
            x=cx+(R-w/2)*math.cos(math.radians(ang)); y=cy+(R-w/2)*math.sin(math.radians(ang))
            ld.ellipse([x-w/2,y-w/2,x+w/2,y+w/2],fill=col+(255,))
        glow=lay.filter(ImageFilter.GaussianBlur(18))
        img=Image.alpha_composite(img.convert('RGBA'),glow); img=Image.alpha_composite(img,lay).convert('RGB')
    img=img.resize((size,size),Image.LANCZOS)
    return img
os.makedirs(OUT,exist_ok=True)
for s in (180,192,512):
    make(s).save(os.path.join(OUT,f'icon-{s}.png'))
make(512,True).save(os.path.join(OUT,'icon-maskable-512.png'))
make(32).save(os.path.join(OUT,'favicon-32.png'))
print('ok')
