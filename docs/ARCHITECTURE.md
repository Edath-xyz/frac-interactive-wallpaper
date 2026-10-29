# Configuration and Maintenance Boundaries

`content → Validation & Compilation → preview/<host> → Whitelist-based Packaging → dist`

| Location | Responsibility |
| --- | --- |
| `content/project.json` | Project ID, title, author, brand, character designation, default outfit and image quality, volume, and dialogue spacing |
| `content/wardrobes.json` | Names of 1–3 wardrobes, default styles, relative background paths, and display order; automatic pagination every four outfits |
| `content/looks/<id>/look.json` | Video type, timing parameters, file names, associated wardrobe, and assigned host index |
| `dialogue.json` (in the same directory) | Paired entry/follow-up dialogue, return-to-playback dialogue, random dialogue, and continuous/intimate dialogue for this specific set |
| `content/shared-dialogue.json` | Interaction responses shared across all three wardrobes; excludes outfit-specific dialogue content |
| `content/sample-manifest.json` | File and text fingerprints for the original sample content; serves as a reminder for replacement—not modified for individual projects |
| `src/player` | Logic for dual-video playback, exit sequences, looping, dialogue selection, UI, and pause handling |
| `src/hosts` | WE (Wallpaper Engine) property notifications, Lively pause notifications, and WE property templates |
| `src/index.html` & CSS | Page structure and existing visual appearance; `{{...}}` placeholders are replaced during the build process |
| `tools/model.py` | Configuration constraints, path boundaries, dialogue pairing, and generation of runtime data |
| `tools/build.py` | Compiles code and configuration; copies only the assets explicitly referenced |
| `tools/media.py`, `project.py` | Asset processing, backups, command-line entry points, and packaging |

## Identity and Ordering

The `look.id` must match its corresponding folder name; it must consist of lowercase letters, numbers, and hyphens, and must begin with a letter. Do not change the ID when renaming an item; assign a new ID only when the content is entirely replaced. `hostValue` serves as a persistent identifier for the WE (Wallpaper Engine) environment; it is automatically assigned by the ingestion tool and is never reused once an item is removed.

While array indices may be used to handle videos during runtime, the saved files contain complete `catalogIds`. Upon loading, the system remaps current outfits, favorites, custom freeze-frames, and wardrobe memories based on these IDs, ensuring that additions, deletions, or reordering do not cause data misalignment. Dialogue history is tracked using a combination of outfit IDs and sentence IDs.

Storage keys for projects are generated using `project.id + host`, encompassing layout, font size, and dialogue history. New projects receive new IDs, while updates to an existing project retain the original ID. Storage keys or Workshop IDs from the original author’s project are not inherited.

`project.author` is used to store the author information within the host environment; the template interface does not overlay author names or Bilibili watermarks. Copyright notices for the code remain in the license file.

## `look.json` Parameters

- `kind`: Defines the behavior—`entry` (static freeze-frame upon entry), `departure` (freeze-frame upon entry, followed by an exit sequence that allows for continued playback), or `companion` (loops after entry).
- `freeze`, `duration`, `loopStart`, and `loopEnd` are all measured in seconds. `loopEnd` excludes the subsequent frame and typically marks the end of the clip; the dynamic freeze-frame point aligns with the start of the loop.
- `fps`, `width`, and `height` must reflect the processed video, not the original MP4 file. The ingestion tool outputs 60 FPS VP9 WebM files; the core build process does not perform further transcoding.
- `transition` applies only to the exit sequence: `lead` (pre-exit preparation time) and `fade` (fade-in duration); defaults are 0.5s and 0.4s, respectively.
- `video`, `cover`, `still`, and `dialogue` must be specified as relative paths within the current outfit directory; absolute paths or `..` (parent directory references) are not permitted.
- `qualities` is optional—for example: `{"1440p": "1440p.webm"}`. The base video is always present; the UI reflects the actual base resolution, and options for unavailable resolutions are disabled (unclickable).
- `sample` serves as an indicator of the source; it is set to `true` for the initial sample assets. When integrating your own videos, this should be set to `false`, though doing so does not automatically alter the scope of existing dialogue usage.

`project.defaultQuality` can be set to `original`, `1440p`, or `1080p`. `original` refers to the specific set of base files provided—it does not inherently imply 4K resolution (for instance, the four sets of initial sample assets are 1080p).

## Playback Boundaries

The two video streams and the cancellation token remain managed by the player. Do not conflate system-level pauses or browser tab hiding with a user-initiated pause. Browsing the wardrobe does not trigger a scene change; a scene change only occurs when a cover image is selected. Automatic transitions must be based on the wardrobe currently being played, not the one currently being browsed.

The `build` command does not launch the application, connect to the internet, or perform a release. The `pack` command triggers a fresh build and exports files according to a manifest, ensuring that `.generated.json` files or development assets are not included in the final wallpaper ZIP. The `source` command is used to export a source ZIP containing documentation, tools, and sample content.
