"""Build only declared content. Generated previews never become source."""
from pathlib import Path
import json, html, re, shutil, tempfile, os
from model import ROOT, compile_content, local, write, require, sha

def js(value): return json.dumps(value,ensure_ascii=False).replace('<','\\u003c').replace('>','\\u003e')

def replace_once(source,marker,value):
    require(source.count(marker)==1,'Build marker changed: '+marker)
    return source.replace(marker,value)

def build(root=ROOT,host='wallpaper-engine'):
    root=Path(root); require(host in ['wallpaper-engine','lively'],'Unsupported host')
    project,groups,specs,wardrobes,seams,data=compile_content(root)
    src=root/'src';player=src/'player'
    read=lambda name:(player/(name+'.js')).read_text('utf-8')
    prefs='purple-diy.'+project['id']+'.'+host+'.v1'
    looks=data['PURPLE_LOOKS'];default=specs[project['defaultLook']]
    qualities=['original']+[q for q in ['1440p','1080p'] if any(q in s.get('qualities',{}) for s in specs.values())]
    app=read('app')
    modules={'LOCKED_TAP':'locked-tap','CAROUSEL_ORDER':'carousel-order','MEDIA_DECKS':'media-decks','PLAYBACK':'loop-controller',
             'COMPANION':'companion-loop','COMPANION_SPEECH':'companion-speech','QUALITY':'quality','AUTO_SWITCH':'auto-switch','RESET':'reset-settings','HELP':'help'}
    for key,name in modules.items(): app=replace_once(app,'  /* @PURPLE_SAFE_'+key+' */',read(name))
    app=replace_once(app,'  /* @PURPLE_HOST_BRIDGE */',(src/'hosts'/(host+'.js')).read_text('utf-8'))
    replacements={'__PURPLE_WARDROBES__':js(wardrobes),'__PURPLE_LOOP_SEAMS__':js(seams),
        '__PURPLE_PREFS_KEY__':prefs,'__DEFAULT_INDEX__':str(next(i for i,x in enumerate(looks) if x['id']==default['id'])),
        '__DEFAULT_SOUND__':js(project['sound']),'__DEFAULT_VOLUME__':str(project['volume']),
        '__DEFAULT_QUALITY__':project['defaultQuality'],'__VIDEO_QUALITIES__':js(qualities),
        '__CHARACTER_NAME__':js(project['characterName'])[1:-1].replace("'", "\\'")}
    for marker,value in replacements.items():
        require(marker in app,'Missing marker '+marker);app=app.replace(marker,value)
    for module,key,suffix in [('layout-position','LAYOUT','layout-v1'),('readability','READING','reading-v1'),('dual-layout','INTERFACE','interface')]:
        app+='\n'+replace_once(read(module),'__PURPLE_'+key+'_KEY__',prefs+'.'+suffix)
    app+='\n'+read('interaction-feedback')
    catalog='\n'.join('window.'+key+' = Object.freeze('+js(value)+');' for key,value in data.items())+'\n'
    tokens={'title':project['title'],'prefsKey':prefs,'brand':project['brand'],'tagline':project['tagline'],'wardrobeTitle':project['wardrobeTitle'],
        'collectionLabel':project['brand']+' / COLLECTION','defaultName':default['name'],'defaultStill':'images/look-'+default['id']+'.jpg',
        'defaultBackground':'images/'+next(g['empty'] for g in wardrobes if g['id']==default['wardrobe']),
        'dialogueInterval':str(project['dialogueIntervalSeconds'])}
    template=(src/'index.html').read_text('utf-8')
    for key,value in tokens.items(): template=template.replace('{{'+key+'}}',html.escape(value,quote=True))
    tabs=''.join(f'<button type="button" data-wardrobe="{g["id"]}" aria-pressed="false"><span>{i+1:02d}</span>{html.escape(g["name"])}</button>' for i,g in enumerate(groups))
    template=template.replace('{{wardrobeTabs}}','<nav id="wardrobeTabs" class="wardrobe-collections" aria-label="选择衣橱">'+tabs+'</nav>')
    buttons=''.join(f'<button type="button" data-quality="{q}" aria-pressed="false">{ "基础视频" if q=="original" else q.upper()}</button>' for q in qualities)
    template=template.replace('{{qualityButtons}}',buttons)
    css=(src/'style.css').read_text('utf-8')
    for key,value in tokens.items(): css=css.replace('{{'+key+'}}',value)
    require(not re.search(r'\{\{\w+\}\}|__[A-Z][A-Z_]+__',template+app+css),'Unresolved template marker')
    generated={'index.html':template,'app.js':app,'catalog.js':catalog,'dialogue-engine.js':read('companion-dialogue-engine')+'\n'+read('dialogue-engine'),
               'style.css':css,'glass.css':(src/'glass.css').read_text('utf-8')}
    if host=='wallpaper-engine':
        metadata=json.loads((src/'hosts/wallpaper-engine.json').read_text('utf-8'))
        metadata.update(title=project['title'],description=project['description'])
        properties=metadata['general']['properties'];properties['sound']['value']=project['sound'];properties['volume']['value']=project['volume']
        properties['look']['options']=[{'label':'记住上次选择','value':'0'}]+[{'label':s['name'],'value':str(s['hostValue'])} for g in groups for id in g['looks'] for s in [specs[id]]]
        properties['startupinterface']={'order':8,'text':'启动时界面','type':'combo','value':'remember','options':[{'label':a,'value':b} for a,b in [('记住上次状态','remember'),('默认沉浸','immersed'),('默认显示','visible')]]}
        generated['project.json']=json.dumps(metadata,ensure_ascii=False,indent=2)+'\n'
    else:
        generated['LivelyInfo.json']=json.dumps({'AppVersion':'2.2.1.0','Title':project['title'],'Thumbnail':'preview.jpg','Preview':None,'Desc':project['description'],
            'Author':project['author'],'License':'0BSD (code); see CONTENT-LICENSE.md for samples','Contact':None,'Type':1,'FileName':'index.html','Arguments':'--pause-event true',
            'IsAbsolutePath':False,'Id':None,'Tags':['互动','陪伴'],'Version':1},ensure_ascii=False,indent=2)+'\n'
    assets={}
    for id,item in specs.items():
        folder=root/'content/looks'/id
        assets['media/look-'+id+'.webm']=local(folder,item['video'])
        assets['images/look-'+id+'.jpg']=local(folder,item['still'])
        assets['images/thumb-'+id+'.jpg']=local(folder,item['cover'])
        for q,path in item.get('qualities',{}).items(): assets['media/'+q+'/look-'+id+'.webm']=local(folder,path)
    for g,w in zip(groups,wardrobes): assets['images/'+w['empty']]=local(root,g['background'])
    assets['preview.jpg']=local(root/'content/looks'/default['id'],default['cover'])
    for name in ['LICENSE','CONTENT-LICENSE.md','NOTICE.md']:
        if (root/name).is_file(): assets[name]=root/name
    parent=root/'preview';parent.mkdir(exist_ok=True)
    destination=parent/host
    with tempfile.TemporaryDirectory(prefix='.build-',dir=parent) as temporary:
        staging=Path(temporary)
        for name,content in generated.items(): (staging/name).write_text(content,encoding='utf-8')
        for name,source in assets.items():
            target=staging/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,target)
        manifest={p.relative_to(staging).as_posix():sha(p) for p in staging.rglob('*') if p.is_file()}
        # Only replace this tool's generated host directory; never delete source.
        backup=parent/('.previous-'+host)
        require(not backup.exists(),'Previous interrupted build exists; inspect '+str(backup))
        if destination.exists():
            require((destination/'.generated.json').is_file(),'Refusing to replace an unmarked directory: '+str(destination))
            destination.rename(backup)
        try:
            write(staging/'.generated.json',{'host':host,'files':manifest,'projectId':project['id']})
            staging.rename(destination)
        except BaseException:
            if backup.exists(): backup.rename(destination)
            raise
        if backup.exists(): shutil.rmtree(backup)
    return destination,manifest
