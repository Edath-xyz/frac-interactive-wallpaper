"""Portable content contract; no dependencies beyond Python's standard library."""
from pathlib import Path
import json, re, math, hashlib

ROOT = Path(__file__).resolve().parents[1]
SLUG = re.compile(r'^[a-z][a-z0-9-]{0,63}$')
OPERATIONS = ('favorite','unfavorite','replay','pause','resume','edit','saved','cancel','reset','wake')

def read(path):
    return json.loads(Path(path).read_text('utf-8-sig'))

def write(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

def require(condition, message):
    if not condition: raise ValueError(message)

def slug(value, label):
    require(isinstance(value,str) and SLUG.fullmatch(value), f'{label}: use lowercase letters, digits and hyphens; start with a letter')

def text(value, label):
    require(isinstance(value,str) and value.strip() and '\x00' not in value, f'{label}: nonempty text required')

def number(value, label, minimum, maximum):
    require(type(value) in (int,float) and math.isfinite(value) and minimum <= value <= maximum,
            f'{label}: expected number within {minimum}..{maximum}')

def local(base, relative):
    require(isinstance(relative,str) and relative and '\\' not in relative and ':' not in relative, f'Invalid relative path: {relative!r}')
    path = (Path(base) / relative).resolve()
    require(path.is_relative_to(Path(base).resolve()) and '..' not in Path(relative).parts and not Path(relative).is_absolute(), f'Path escapes content: {relative}')
    require(path.is_file(), f'Missing file: {relative}')
    return path

def sha(path):
    h=hashlib.sha256()
    with Path(path).open('rb') as f:
        for block in iter(lambda:f.read(1024*1024),b''): h.update(block)
    return h.hexdigest()

def dialogue(data, kind, label):
    require(isinstance(data,dict) and type(data.get('enabled')) is bool, f'{label}: enabled must be true or false')
    if not data['enabled']: return
    entries=data.get('entries')
    require(isinstance(entries,list) and entries, f'{label}: at least one entry/held pair required')
    ids=[]
    for entry in entries:
        slug(entry.get('id'),label+'.entry.id');ids.append(entry['id'])
        text(entry.get('enter'),label+'.enter');text(entry.get('held'),label+'.held')
    for key in ['restored','random'] + (['continuous','affection'] if kind=='companion' else []):
        values=data.get(key)
        require(isinstance(values,list) and values, f'{label}: nonempty {key} required when enabled')
        for line in values:
            slug(line.get('id'),label+'.'+key+'.id'); ids.append(line['id'])
            text(line.get('text'),label+'.'+key+'.text')
            if 'topic' in line: text(line['topic'],label+'.topic')
    require(len(set(ids))==len(ids), f'{label}: duplicate dialogue IDs')
    for pair in data.get('affectionScenes',[]):
        text(pair.get('enter'),label+'.affection.enter');text(pair.get('held'),label+'.affection.held')

def load(root=ROOT):
    root=Path(root)
    project=read(root/'content/project.json'); slug(project.get('id'),'project.id')
    require(project.get('schemaVersion')==1,'Unsupported schemaVersion')
    for key in ['title','author','brand','tagline','wardrobeTitle','characterName','description']: text(project.get(key),'project.'+key)
    number(project.get('volume'),'volume',0,100)
    number(project.get('dialogueIntervalSeconds'),'dialogueIntervalSeconds',5,3600)
    number(project.get('affectionAfter'),'affectionAfter',1,100)
    require(type(project.get('sound')) is bool,'sound must be boolean')
    groups=read(root/'content/wardrobes.json')
    require(isinstance(groups,list) and groups,'At least one wardrobe required')
    require(len(groups)<=3,'This layout supports up to three wardrobes')
    group_ids=[];listed=[]
    for group in groups:
        slug(group.get('id'),'wardrobe.id');group_ids.append(group['id'])
        text(group.get('name'),'wardrobe.name');text(group.get('english'),'wardrobe.english')
        require(isinstance(group.get('looks'),list) and group['looks'],'Empty wardrobe: remove the wardrobe or add a look')
        require(group.get('defaultLook') in group['looks'],'wardrobe.defaultLook must be in this wardrobe')
        listed+=group['looks'];local(root,group['background'])
    require(len(set(group_ids))==len(groups),'Duplicate wardrobe ID')
    require(len(set(listed))==len(listed),'A look appears more than once in wardrobe ordering')
    specs={};dialogues={};host_values=[]
    for path in sorted((root/'content/looks').glob('*/look.json')):
        item=read(path);id=item.get('id');slug(id,'look.id')
        require(path.parent.name==id,'look.id must equal its folder name')
        require(id not in specs,'Duplicate look ID')
        require(item.get('kind') in ['entry','departure','companion'],'kind must be entry, departure or companion')
        require(item.get('wardrobe') in group_ids,'Unknown wardrobe for '+id)
        require(id in next(g for g in groups if g['id']==item['wardrobe'])['looks'],'Wardrobe and look disagree: '+id)
        text(item.get('name'),id+'.name');text(item.get('english'),id+'.english')
        require(type(item.get('hostValue')) is int and item['hostValue']>0,'Positive integer hostValue required: '+id)
        host_values.append(item['hostValue'])
        number(item.get('duration'),id+'.duration',.2,3600)
        number(item.get('fps'),id+'.fps',1,240)
        number(item.get('freeze'),id+'.freeze',.1,item['duration']-.05)
        for key in ['width','height']: number(item.get(key),id+'.'+key,2,16384)
        for key,suffix in [('video','.webm'),('cover','.jpg'),('still','.jpg'),('dialogue','.json')]:
            p=local(path.parent,item[key]);require(p.suffix.lower()==suffix, f'{id}.{key}: expected {suffix}')
        qualities=item.get('qualities',{})
        require(isinstance(qualities,dict) and set(qualities)<={'1080p','1440p'},'Supported optional qualities: 1080p, 1440p')
        for key,value in qualities.items(): require(local(path.parent,value).suffix=='.webm','Quality must be WebM')
        if item['kind']=='companion':
            number(item.get('loopStart'),id+'.loopStart',.1,item['duration']-.1)
            number(item.get('loopEnd'),id+'.loopEnd',item['loopStart']+.1,item['duration']+.001)
            require(abs(item['freeze']-item['loopStart'])<1/item['fps']+.001,'Companion freeze must match loopStart')
        if item['kind']=='departure':
            recipe=item.get('transition',{})
            number(recipe.get('lead'),id+'.transition.lead',.05,2)
            number(recipe.get('fade'),id+'.transition.fade',.05,2)
            require(item['duration']-item['freeze']>recipe['lead'],'Departure needs a tail after freeze')
        data=read(local(path.parent,item['dialogue']));dialogue(data,item['kind'],id)
        specs[id]=item;dialogues[id]=data
    require(set(specs)==set(listed),'Wardrobe references and content folders differ: '+str(set(specs)^set(listed)))
    require(len(set(host_values))==len(host_values),'Duplicate hostValue; never reuse an existing host identity')
    require(project.get('defaultLook') in specs,'project.defaultLook must exist')
    available={'original'}|{q for s in specs.values() for q in s.get('qualities',{})}
    require(project.get('defaultQuality') in available,'Default quality not provided by this project')
    shared=read(root/'content/shared-dialogue.json')
    require(isinstance(shared.get('replies'),dict),'shared.replies must be an object')
    for key in OPERATIONS:
        values=shared['replies'].get(key)
        require(isinstance(values,list),'Missing operation: '+key)
        for line in values: text(line,'shared.'+key)
    require(isinstance(shared.get('fixed'),dict),'shared.fixed must be an object')
    for value in shared['fixed'].values(): text(value,'shared.fixed')
    return project,groups,specs,dialogues,shared

def compile_content(root=ROOT):
    project,groups,specs,dialogues,shared=load(root)
    looks=[];wardrobes=[];seams={};companion={};affection={'looks':{},'shared':shared.get('affection',{})}
    for id in sorted(specs):
        item=specs[id];d=dialogues[id]
        look={'id':id,'name':item['name'],'short':item['name'],'english':item['english'],'group':item['wardrobe'],
              'hostValue':item['hostValue'],'freeze':item['freeze'],'duration':item['duration'],'fps':item['fps'],
              'locked':False,'silent':not d['enabled'],'videoQualities':['original',*item.get('qualities',{})],
              'baseQualityLabel':str(min(item['width'],item['height']))+'P',
              'dialogue':{'enter':[''],'held':[''],'restored':[''],'random':['']}}
        if d['enabled']:
            look['dialogue']={'enter':[x['enter'] for x in d['entries']],'held':[x['held'] for x in d['entries']],
                             **{k:[x['text'] for x in d[k]] for k in ['restored','random']}}
            affection['looks'][id]={'scenes':d.get('affectionScenes',[])}
        if item['kind']=='departure': seams[id]=item['transition']
        if item['kind']=='companion':
            look['companion']={'startFrame':round(item['loopStart']*item['fps']),'endFrame':round(item['loopEnd']*item['fps']),'fps':item['fps']}
            if not d['enabled']: look['dialoguePending']=True
            else:
                companion[id]={'name':item['name'],'settledAt':item['loopStart'],
                    'enter':[{'id':id+'-'+x['id'],'text':x['enter'],'follow':{'id':id+'-'+x['id']+'-follow','text':x['held']}} for x in d['entries']],
                    **{k:[dict(x,id=id+'-'+x['id']) for x in d[k]] for k in ['continuous','restored','random','affection']}}
        looks.append(look)
    for group in groups:
        wardrobes.append({'id':group['id'],'name':group['name'],'english':group['english'],'defaultLook':group['defaultLook'],
            'empty':'background-'+group['id']+Path(group['background']).suffix,
            'chapters':[{'name':group['name']+' · '+str(i//4+1),'looks':group['looks'][i:i+4]} for i in range(0,len(group['looks']),4)]})
    data={'PURPLE_PROJECT':{'wardrobeTitle':project['wardrobeTitle']},'PURPLE_LOOKS':looks,'PURPLE_REPLIES':shared['replies'],'PURPLE_AFFECTION':affection,
          'PURPLE_WARDROBE_DIALOGUES':{g['id']:{'replies':shared['replies'],'fixed':shared['fixed']} for g in groups},
          'PURPLE_COMPANION_DIALOGUES':{'version':1,'timing':{'intervalMs':[project['dialogueIntervalSeconds']*1000]*2,'rareAfterRegular':project['affectionAfter']},'looks':companion}}
    return project,groups,specs,wardrobes,seams,data
