"""PURPLE DIY command line. Run `python tools/project.py --help`."""
from pathlib import Path
import argparse,json,shutil,tempfile,sys,zipfile,datetime,os,importlib.util,subprocess
from model import ROOT,load,read,write,require,slug,local,sha,dialogue,text
from build import build
from media import probe,transcode,pictures

def backup(root,paths):
    folder=root/'.history'/datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f')
    for p in paths:
        if not p.exists(): continue
        target=folder/p.relative_to(root);target.parent.mkdir(parents=True,exist_ok=True)
        if p.is_dir(): shutil.copytree(p,target)
        else: shutil.copy2(p,target)
    return folder

def check(root,media=False):
    p,g,s,d,shared=load(root)
    report={'looks':len(s),'wardrobes':len(g),'companions':sum(x['kind']=='companion' for x in s.values()),'mediaChecked':media}
    if media:
        details=[]
        for id,item in s.items():
            folder=root/'content/looks'/id
            for quality,file in [('original',item['video']),*item.get('qualities',{}).items()]:
                actual=probe(local(folder,file),count=True)
                require(actual['codec']=='vp9',id+': expected VP9 WebM')
                require(abs(actual['fps']-item['fps'])<.01,id+': FPS differs')
                require(abs(actual['duration']-item['duration'])<max(.08,1/item['fps']),id+': duration differs')
                if quality=='original': require((actual['width'],actual['height'])==(item['width'],item['height']),id+': resolution differs')
                details.append({'id':id,'quality':quality,**actual})
        report['media']=details
    return report

def strings(value):
    if isinstance(value,str): yield value
    elif isinstance(value,list):
        for x in value: yield from strings(x)
    elif isinstance(value,dict):
        for key,x in value.items():
            if key not in {'id','topic'}: yield from strings(x)

def release_audit(root):
    p,g,s,d,shared=load(root)
    problems=[]
    if p.get('sample') is not False or p['id']=='purple-diy-demo': problems.append('Set a new project id and sample:false in content/project.json after replacing demo content.')
    samples=read(root/'content/sample-manifest.json')
    blocked=set(samples['files'].values());sentences=set(samples.get('textHashes',[]))
    assets=[local(root,group['background']) for group in g]
    for id,item in s.items():
        if item.get('sample') is not False: problems.append(id+': sample flag is still enabled')
        folder=root/'content/looks'/id
        assets += [local(folder,item[key]) for key in ['video','cover','still','dialogue']]
        assets += [local(folder,x) for x in item.get('qualities',{}).values()]
    assets.append(root/'content/shared-dialogue.json')
    for path in assets:
        if sha(path) in blocked: problems.append('Original demo file remains: '+path.relative_to(root).as_posix())
    import hashlib
    for id,data in [*d.items(),('shared',shared)]:
        if any(hashlib.sha256(t.encode('utf-8')).hexdigest() in sentences for t in strings(data)):
            problems.append('Original sample dialogue remains: '+id)
    require(not problems,'Publish audit failed:\n'+'\n'.join(problems))

def media_change(args,root):
    p,groups,specs,_,_=load(root)
    slug(args.id,'id');source=Path(args.source).expanduser().resolve();require(source.is_file(),'Source video not found')
    info=probe(source);old=specs.get(args.id)
    require((old is None)==(args.command=='add'),'Use add for a new ID; replace for an existing ID')
    kind=args.kind or (old or {}).get('kind')
    require(kind in ['entry','departure','companion'],'Specify --kind')
    group=args.wardrobe or (old or {}).get('wardrobe');require(group in [g['id'] for g in groups],'Unknown wardrobe')
    if old: require(group==old['wardrobe'],'Move wardrobe via wardrobes.json and look.json together')
    freeze=args.loop_start if kind=='companion' else args.freeze
    require(freeze is not None,'Specify --loop-start for companion, --freeze for entry/departure. Replacement must confirm new timing.')
    require(.1<=freeze<info['duration']-.05,'Freeze/loop start outside source duration')
    end=args.loop_end
    if end is not None: require(kind=='companion' and freeze+.1<=end<=info['duration']+.001,'Invalid loop end')
    require(args.height in [1080,1440,2160],'Unsupported target height')
    name=args.name or (old or {}).get('name');require(bool(name),'Specify --name')
    plan={'operation':args.command,'id':args.id,'name':name,'wardrobe':group,'kind':kind,'source':str(source),'sourceInfo':info,'freeze':freeze,
          'loopEnd':end,'height':args.height,'apply':args.apply,'note':'Input is read-only. Replace invalidates optional quality files; regenerate those from the same new source.'}
    if not args.apply: return plan
    qa=root/'.qa';qa.mkdir(exist_ok=True)
    target=root/'content/looks'/args.id
    with tempfile.TemporaryDirectory(prefix='media-',dir=qa) as temp:
        stage=Path(temp)/args.id;stage.mkdir()
        measured=transcode(source,stage/'video.webm',args.height)
        require(freeze<measured['duration']-.05,'Freeze exceeds encoded duration')
        pictures(stage/'video.webm',stage,args.cover_time if args.cover_time is not None else freeze,args.cover_x,args.cover_y)
        item={'id':args.id,'name':name,'english':args.english or (old or {}).get('english','HERE, WITH YOU'), 'wardrobe':group,
              'hostValue':old['hostValue'] if old else max([x['hostValue'] for x in specs.values()]+p.get('retiredHostValues',[])+[0])+1,
              'kind':kind,'freeze':freeze,'duration':measured['duration'],'fps':measured['fps'],'width':measured['width'],'height':measured['height'],
              'video':'video.webm','cover':'cover.jpg','still':'still.jpg','qualities':{},'dialogue':'dialogue.json','sample':False}
        if kind=='companion': item.update(loopStart=freeze,loopEnd=end if end is not None else measured['duration'])
        if kind=='departure': item['transition']={'lead':.5,'fade':.4}
        data=read(local(target,old['dialogue'])) if old and old['kind']==kind else {'enabled':False}
        if args.dialogue:
            data=read(Path(args.dialogue));dialogue(data,kind,args.id)
        write(stage/'look.json',item);write(stage/'dialogue.json',data)
        saved=backup(root,[target,root/'content/wardrobes.json'])
        if old: target.rename(Path(temp)/'previous')
        try:
            stage.rename(target)
            if not old:
                next(g for g in groups if g['id']==group)['looks'].append(args.id)
                write(root/'content/wardrobes.json',groups)
            load(root)
        except BaseException:
            if target.exists(): shutil.rmtree(target)
            if old: (Path(temp)/'previous').rename(target)
            shutil.copy2(saved/'content/wardrobes.json',root/'content/wardrobes.json')
            raise
    return {**plan,'backup':str(saved),'result':'applied'}

def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root',type=Path,default=ROOT,help='Project root (defaults to this script location)')
    sub=parser.add_subparsers(dest='command',required=True)
    sub.add_parser('doctor');c=sub.add_parser('check');c.add_argument('--media',action='store_true')
    c=sub.add_parser('build');c.add_argument('--host',choices=['wallpaper-engine','lively','both'],default='wallpaper-engine')
    c=sub.add_parser('init');c.add_argument('--id',required=True);c.add_argument('--title',required=True);c.add_argument('--author',required=True);c.add_argument('--apply',action='store_true')
    for command in ['add','replace']:
        c=sub.add_parser(command);c.add_argument('--id',required=True);c.add_argument('--source',required=True);c.add_argument('--name');c.add_argument('--english');c.add_argument('--wardrobe');c.add_argument('--kind',choices=['entry','departure','companion']);c.add_argument('--freeze',type=float);c.add_argument('--loop-start',type=float);c.add_argument('--loop-end',type=float);c.add_argument('--height',type=int,default=1080);c.add_argument('--cover-time',type=float);c.add_argument('--cover-x',type=float,default=.5);c.add_argument('--cover-y',type=float,default=.5);c.add_argument('--dialogue');c.add_argument('--apply',action='store_true')
    c=sub.add_parser('quality');c.add_argument('--id',required=True);c.add_argument('--source',required=True);c.add_argument('--height',type=int,choices=[1080,1440],required=True);c.add_argument('--apply',action='store_true')
    c=sub.add_parser('remove');c.add_argument('--id',required=True);c.add_argument('--apply',action='store_true')
    c=sub.add_parser('dialogue');c.add_argument('--id',required=True);c.add_argument('--file',required=True);c.add_argument('--apply',action='store_true')
    c=sub.add_parser('pack');c.add_argument('--host',choices=['wallpaper-engine','lively'],required=True);c.add_argument('--demo',action='store_true',help='Local demo import only; not a publishable content license');c.add_argument('--name')
    sub.add_parser('source')
    args=parser.parse_args(argv);root=args.root.resolve()
    if args.command=='doctor':
        node_version=subprocess.check_output(['node','--version'],encoding='utf-8').strip() if shutil.which('node') else None
        result={'python':sys.version.split()[0],'ffmpeg':bool(shutil.which('ffmpeg')),'ffprobe':bool(shutil.which('ffprobe')),'pillow':importlib.util.find_spec('PIL') is not None,'node':node_version,'browserTestsNeed':'Node >=22.12 and Chrome; basic build only needs Python','content':check(root)}
    elif args.command=='check': result=check(root,args.media)
    elif args.command=='build':
        hosts=['wallpaper-engine','lively'] if args.host=='both' else [args.host]
        result={h:str(build(root,h)[0]/'index.html') for h in hosts}
    elif args.command in ['add','replace']:
        require(0<=args.cover_x<=1 and 0<=args.cover_y<=1,'Cover coordinates must be within 0..1')
        result=media_change(args,root)
    elif args.command=='init':
        slug(args.id,'project.id');text(args.title,'title');text(args.author,'author');p=read(root/'content/project.json');p.update(id=args.id,title=args.title,author=args.author)
        if args.apply: backup(root,[root/'content/project.json']);write(root/'content/project.json',p)
        result={'project':p,'applied':args.apply,'note':'Keep this ID for future updates. Replace demo content before setting sample:false.'}
    elif args.command=='dialogue':
        _,_,s,_,_=load(root);require(args.id in s,'Unknown look ID');data=read(Path(args.file));dialogue(data,s[args.id]['kind'],args.id)
        target=local(root/'content/looks'/args.id,s[args.id]['dialogue'])
        if args.apply: backup(root,[target]);write(target,data)
        result={'id':args.id,'applied':args.apply}
    elif args.command=='quality':
        _,_,s,_,_=load(root);require(args.id in s,'Unknown look ID');item=s[args.id];source=Path(args.source).resolve();probe(source)
        result={'id':args.id,'height':args.height,'applied':args.apply}
        if args.apply:
            folder=root/'content/looks'/args.id;qa=root/'.qa';qa.mkdir(exist_ok=True)
            with tempfile.TemporaryDirectory(dir=qa) as temp:
                video=Path(temp)/'quality.webm';actual=transcode(source,video,args.height)
                require(abs(actual['duration']-item['duration'])<1/item['fps']+.005,'Quality duration differs; use the same original source')
                require(abs(actual['fps']-item['fps'])<.01,'Quality FPS differs')
                key=str(args.height)+'p';name=key+'.webm';backup(root,[folder]);shutil.copy2(video,folder/name)
                item['qualities'][key]=name;write(folder/'look.json',item)
    elif args.command=='remove':
        p,groups,s,_,_=load(root);require(args.id in s,'Unknown look ID');require(len(s)>1,'Cannot remove the last look')
        target=root/'content/looks'/args.id
        for g in groups:
            g['looks']=[id for id in g['looks'] if id!=args.id]
            if g['defaultLook']==args.id: g['defaultLook']=g['looks'][0] if g['looks'] else None
        groups=[g for g in groups if g['looks']]
        if p['defaultLook']==args.id: p['defaultLook']=groups[0]['defaultLook']
        remaining_qualities={'original'}|{q for id,item in s.items() if id!=args.id for q in item.get('qualities',{})}
        if p['defaultQuality'] not in remaining_qualities: p['defaultQuality']='original'
        p['retiredHostValues']=sorted(set(p.get('retiredHostValues',[])+[s[args.id]['hostValue']]))
        result={'id':args.id,'applied':args.apply,'note':'Removed content is retained in .history; publish packages only include declared active content.'}
        if args.apply:
            saved=backup(root,[target,root/'content/wardrobes.json',root/'content/project.json'])
            try:
                shutil.rmtree(target);write(root/'content/wardrobes.json',groups);write(root/'content/project.json',p);load(root)
            except BaseException:
                if not target.exists(): shutil.copytree(saved/target.relative_to(root),target)
                for name in ['wardrobes.json','project.json']: shutil.copy2(saved/'content'/name,root/'content'/name)
                raise
            result['backup']=str(saved)
    elif args.command=='pack':
        if not args.demo: release_audit(root)
        destination,manifest=build(root,args.host)
        dist=root/'dist';dist.mkdir(exist_ok=True)
        name=args.name or read(root/'content/project.json')['id']+'-'+args.host+('-demo' if args.demo else '')
        slug(name,'package name');archive=dist/(name+'.zip');require(not archive.exists(),'Package already exists; use a new --name')
        with zipfile.ZipFile(archive,'x',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
            for file in sorted(manifest): z.write(destination/file,file,compress_type=zipfile.ZIP_STORED if file.endswith(('.webm','.jpg')) else zipfile.ZIP_DEFLATED)
        with zipfile.ZipFile(archive) as z: require(z.testzip() is None and set(z.namelist())==set(manifest),'Archive verification failed')
        write(dist/(name+'.manifest.json'),{'archive':archive.name,'sha256':sha(archive),'demoOnly':args.demo,'files':manifest})
        result={'archive':str(archive),'sha256':sha(archive),'demoOnly':args.demo,'files':len(manifest)}
    else:
        # Explicit source allowlist; no caches, personal history, binaries or old exports.
        dist=root/'dist';dist.mkdir(exist_ok=True);archive=dist/'purple-diy-source.zip';require(not archive.exists(),'Source archive exists; move it aside before generating another')
        _,groups,specs,_,_=load(root)
        paths=[p for folder in ['src','tools','docs','tests'] for p in (root/folder).rglob('*') if p.is_file() and '__pycache__' not in p.parts and p.suffix!='.pyc']
        paths += [root/name for name in ['README.md','AGENTS.md','LICENSE','CONTENT-LICENSE.md','NOTICE.md','.gitignore','.gitattributes','package.json','package-lock.json','requirements-media.txt','dev.ps1']]
        paths += [root/'content'/name for name in ['project.json','wardrobes.json','shared-dialogue.json','sample-manifest.json']]
        paths += [local(root,g['background']) for g in groups]
        for id,item in specs.items():
            folder=root/'content/looks'/id;paths.append(folder/'look.json')
            paths += [local(folder,item[key]) for key in ['video','cover','still','dialogue']]
            paths += [local(folder,file) for file in item.get('qualities',{}).values()]
        paths=sorted(set(paths))
        with zipfile.ZipFile(archive,'x',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
            for p in sorted(paths): z.write(p,p.relative_to(root).as_posix(),compress_type=zipfile.ZIP_STORED if p.suffix in ['.webm','.jpg'] else zipfile.ZIP_DEFLATED)
        with zipfile.ZipFile(archive) as z: require(z.testzip() is None,'Source ZIP corrupted')
        result={'archive':str(archive),'sha256':sha(archive),'files':len(paths)}
    print(json.dumps(result,ensure_ascii=False,indent=2))
    return result

if __name__=='__main__':
    try: main()
    except (ValueError,KeyError,FileNotFoundError,json.JSONDecodeError) as e:
        print('ERROR: '+str(e),file=sys.stderr);sys.exit(1)
