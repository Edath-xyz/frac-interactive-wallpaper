# Video DIY

You must have FFmpeg installed, and the commands `ffmpeg -version` and `ffprobe -version` must be accessible from your terminal. Source video files can be stored outside the repository—the commands will simply read them; please do not commit large source video files to Git. If a file path contains spaces or non-ASCII (e.g., Chinese) characters, enclose it in quotation marks.

Before your first processing task, run `python -m pip install -r requirements-media.txt`. For screenshots, the workflow uses an explicit YUV-to-RGB conversion and outputs sRGB JPEGs; this minimizes color discrepancies between the suggested "freeze-frame" preview and the actual video. The current pipeline is designed for SDR BT.709 video. If color metadata is missing, the system defaults to BT.709 with a "limited" color range (source metadata will be displayed in the plan). For HDR or other color gamuts, please prepare an SDR version of the source video first; the tools will not automatically perform HDR tone mapping.

## Adding New Content

First, determine the playback type and the relevant timestamps. Use `entry` for a freeze-frame after the character enters; `departure` requires an actual exit sequence; and `companion` requires a segment suitable for looping. By default, the command only analyzes the video—it will not transcode or write any files:

```powershell
python -X utf8 tools/project.py add --id my-first-look --name "New Outfit" --wardrobe classic --kind entry --source "source_video.mp4" --freeze 10.5
```

Once you have verified the settings, append `--apply` to the same command. The tool will generate a directory at `content/looks/my-first-look`, automatically assign a `hostValue`, add the item to the wardrobe, and generate the necessary video and image assets. New entries default to `enabled: false` and contain no dialogue; please follow the dialogue guidelines to add the required text, then enable the item.

Example of a dynamic "companion" (idle) sequence:

```powershell
python -X utf8 tools/project.py add --id my-idle-look --name "Quiet Companionship" --wardrobe sit --kind companion --source "dynamic_source.mp4" --loop-start 8 --apply
```

In this example, the entry begins at 0 seconds, and the segment from 8 seconds to the end of the video will loop. If there is a segment at the end of the clip that you do not wish to include in the loop, use `--loop-end 18.5`. The specified timestamp must fall within the actual duration of the video; you will need to verify whether the transition is seamless, as the tool cannot automatically determine the optimal loop point for you.

## Replacing an Existing Entry

```powershell
python -X utf8 tools/project.py replace --id classic-sample --source "my_entry.mp4" --name "My New Name" --freeze 9.5 --apply
python -X utf8 tools/project.py replace --id sit-companion --source "my_companion.mp4" --loop-start 7.5 --apply
```

Replacing an entry preserves the original ID, host index, and dialogue type; however, it does not automatically assume that existing dialogue is compatible with a new outfit. You must re-specify the timestamps—do not inadvertently reuse parameters from the previous video. If you change the entry type, use the `--kind` flag to specify it explicitly; the existing dialogue will be disabled and must be re-configured before it can be used again.

The replacement process regenerates the cover image and the freeze-frame, while clearing any references to previous "enhanced" quality settings. It then regenerates the required assets using the new source MP4 file. The original files and configurations are archived in `.history/<timestamp>`, while the source MP4 remains untouched.

## Cover Images and Video Quality

By default, the cover image is captured at the freeze-frame or the start of the loop. You can use additional parameters: `--cover-time 8.3` to select a specific timestamp for the capture, and `--cover-x 0.65 --cover-y 0.5` to adjust the cropping position for a 3:4 aspect ratio cover (using a range of 0–1). Note that the full-resolution freeze-frame image is not cropped to the character-cover aspect ratio. If you change the designated freeze-frame timestamp, you must also regenerate the freeze-frame image; otherwise, the static frame displayed at startup will not align with the point where playback stops.

By default, base videos are constrained to a maximum resolution of 1920×1080 (maintaining the original aspect ratio) at 60 FPS. You may use `--height 1440` or `--height 2160` to produce higher-resolution base videos. The tool does not simply rename file extensions to masquerade as WebM files. For VP9/Opus processing, the original audio track is preserved; videos without an audio track remain supported.

Adding a quality tier from the same source video:

```powershell
python -X utf8 tools/project.py quality --id my-first-look --source "original_video.mp4" --height 1440 --apply
```

The tool verifies the total duration and frame rate. Do not use a different video—even one of similar length—as a quality tier; the automated checks cannot guarantee that the visual content matches. Upscaling a low-resolution source will not add any genuine detail.

## Reordering, Moving, and Removing

Adjust the `looks` array in `content/wardrobes.json` to change the default order; the interface will still allow users to sort items in ascending or descending order. Do not modify IDs or `hostValue` fields for the purpose of reordering.

When moving an item between wardrobes, update the `wardrobe` field in the corresponding `look.json` file, as well as the `looks` arrays for both affected wardrobes. If the default item is moved, assign a new `defaultLook` to the original wardrobe. Each item must appear exactly once.

```powershell
python -X utf8 tools/project.py remove --id sit-sample
python -X utf8 tools/project.py remove --id sit-sample --apply
```

Removing an item preserves a backup in the `.history` directory and updates the default item. If the last item in a wardrobe is removed, the empty wardrobe itself is also deleted. You cannot delete the final remaining item of an entire project. If an ID is removed, it will be discarded from any existing user collections, while other items in those collections will remain. Do not reuse or reassign IDs that have been retired.

## Backgrounds and Final Review

Transitions between wardrobes utilize the `background` setting defined in `wardrobes.json`. When publishing your own project, ensure that the backgrounds for the two placeholder "empty" scenes are replaced with your own JPG or PNG files, and provide the relative path within the repository. You may use the same custom background across multiple sets. Once finished:

```powershell
python -X utf8 tools/project.py check --media
python -X utf8 tools/project.py build --host both
```

Open the preview and check the entry sequence, stop position, cover image, actual loop seam, audio, and transitions. If you modify the tools or the player, run the automated tests again. Do not assume that a seam is seamless or that playback on the desktop is perfectly smooth just because the tools report success.
