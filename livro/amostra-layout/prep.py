"""Gera as imagens tratadas (duotone kraft) das páginas de amostra."""
import os
from PIL import Image, ImageOps
os.chdir(os.path.dirname(os.path.abspath(__file__)))
SRC = '../img/'
def duo(name, out, dark=(38, 29, 21), light=(214, 199, 168), contrast=1.0):
    im = Image.open(SRC + name + '.jpg').convert('L')
    im = ImageOps.autocontrast(im, cutoff=1)
    ImageOps.colorize(im, dark, light).save('img/' + out + '.jpg', quality=90)
duo('starry', 'starry-kraft')
duo('cypress', 'cypress-kraft')
duo('sorrow', 'sorrow-kraft', light=(236, 232, 222))
duo('roulin', 'roulin-kraft')
duo('harvest', 'harvest-kraft', light=(236, 232, 222))
duo('lacrau', 'lacrau-kraft')
for n in ['c11', 'st-c11-1', 'st-c11-2', 'st-c11-3', 'hero', 'sp_straw']:
    Image.open(SRC + n + '.jpg').convert('RGB').save('img/' + n + '.jpg', quality=90)
