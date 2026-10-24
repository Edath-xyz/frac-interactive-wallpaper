"""Extract full-resolution SDR playback stills with browser-compatible colors.

Do not send BT.709 YUV directly to the JPEG encoder or retain PNG video gamma
tags. Convert limited/full-range YUV to RGB with accurate rounding first, then
encode an explicitly sRGB JPEG without chroma subsampling. Covers are separate.
"""
from pathlib import Path
import json
import subprocess
from PIL import Image, ImageCms

FRAME_RECIPE = 'sdr-accurate-rgb-srgb-jpeg100-444-v1'


def extract_playback_frame(ffmpeg, source, target, time=0):
    ffmpeg = str(ffmpeg)
    binary = Path(ffmpeg)
    ffprobe = str(binary.with_name('ffprobe' + binary.suffix)) if binary.parent != Path('.') else 'ffprobe'
    info = json.loads(subprocess.check_output(
        [ffprobe, '-v', 'error', '-select_streams', 'v:0', '-show_streams',
         '-of', 'json', str(source)], encoding='utf-8'))['streams'][0]
    matrix = {'bt709': 'bt709', 'bt470bg': 'bt601', 'smpte170m': 'bt601'}.get(info.get('color_space'))
    value_range = {'tv': 'tv', 'pc': 'pc'}.get(info.get('color_range'))
    if not matrix or not value_range or info.get('color_transfer') not in ('bt709', 'iec61966-2-1'):
        raise ValueError(f'Unverified playback color space: {source}: {info.get("color_space")}, '
                         f'{info.get("color_range")}, {info.get("color_transfer")}')
    if info.get('color_primaries') != 'bt709':
        raise ValueError(f'Unverified playback primaries: {source}: {info.get("color_primaries")}')
    convert = (f'scale=in_color_matrix={matrix}:in_range={value_range}:out_range=pc:'
               'flags=accurate_rnd+full_chroma_int,format=rgb24')
    pixels = subprocess.check_output([
        ffmpeg, '-hide_banner', '-v', 'error', '-threads', '2', '-ss', str(time),
        '-i', str(source), '-frames:v', '1', '-vf', convert, '-pix_fmt', 'rgb24',
        '-f', 'rawvideo', '-'])
    size = (info['width'], info['height'])
    if len(pixels) != size[0] * size[1] * 3:
        raise ValueError(f'Incomplete frame: {source} at {time}')
    target = Path(target)
    partial = target.with_name(target.stem + '.part.jpg')
    profile = ImageCms.ImageCmsProfile(ImageCms.createProfile('sRGB')).tobytes()
    Image.frombytes('RGB', size, pixels).save(partial, format='JPEG', quality=100,
                                           subsampling=0, optimize=True, icc_profile=profile)
    partial.replace(target)
