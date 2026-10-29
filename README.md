# FRAC_ Interactive Desktop Wallpaper · Open-Source DIY Template

Features three closets and four 1080P sample clips. Includes options for entry-sequence freeze-frames, dynamic "companion" sequences, sequential or random playback, a favorites system, custom freeze-frame selection, and a choice between "classic" or "minimalist" layouts. Projects can be exported for use in Wallpaper Engine (as web-based projects) or as ZIP files for import into Lively Wallpaper; the software runs entirely offline.

**The code is licensed under 0BSD, allowing for modification, commercial use, and redistribution without the need for attribution. Please note that the included videos, images, and sample dialogue are provided solely for personal study and local preview purposes; they must be replaced before you publish your own work.** See the [Code License](LICENSE) and [Sample Content Notice](CONTENT-LICENSE.md) for details.

When creating your own projects using this code, you are not required to mention FRAC_LAB within the wallpaper interface, the videos, or your project descriptions. There is no obligation to tag the original creators, add watermarks, or include links back to this repository. Under 0BSD, you are also not required to retain the original copyright notice or license text in your derivative source code or distribution packages. (Note: Third-party components remain subject to their respective licenses.)

Derivative works are created and published independently by their respective authors, who assume full responsibility for the content, assets, operation, and user support. The use of this code does not imply that the original authors have participated in, produced, endorsed, or partnered with your project. The software is provided "as is," without any guarantees regarding quality or fitness for a particular purpose.

![Closet interface, playback controls, and sample dialogue (minimalist layout)](docs/images/interface-preview.png)

The image above shows a preview of the template in action: select outfits from the closets, and control entry sequences, freeze-frames, and dynamic companion segments. (The interface screenshot itself is also considered restricted sample content.)

## Getting Started

After downloading or cloning this repository, ensure the `content` folder remains intact. The four sample clips are included directly within the source code—no need to download them from external cloud storage, and no Git LFS pointers are used. Python 3.11+ is required. If you are simply building the project using the existing sample clips, you do not need to install Node.js or FFmpeg. Open a terminal in the project root directory:

```powershell
python -X utf8 tools/project.py doctor
python -X utf8 tools/project.py build --host both
```

Open `preview/wallpaper-engine/index.html` directly to preview. `preview/lively/index.html` is the version adapted for Lively. Your browser may require a manual click to enable audio playback; this does not mean the audio tracks are missing.

To test the samples within their respective host applications:

```powershell
python -X utf8 tools/project.py pack --host wallpaper-engine --demo
python -X utf8 tools/project.py pack --host lively --demo
```

The packages can be found in the `dist` directory. For Wallpaper Engine (WE), extract the package and select the `index.html` file within it to create a web-based wallpaper; for Lively, simply add the ZIP file. **Both demo packages are intended for local preview purposes only and must not be published as your own work.** Existing packages will not be overwritten; to export again, use the `--name my-demo-v2` flag.

## Samples

| Stable ID / Folder | Name | Wardrobe | Type & Key Timestamp |
| --- | --- | --- | --- |
| `classic-sample` | Sheer Evening Breeze | Close Affection | Entrance, freeze-frame at 11.23s |
| `sit-sample` | Floral-Adorned Verse | Fleeting Infatuation | Entrance and exit, freeze-frame at 6.8s |
| `sit-companion` | Indigo Evening Breeze | Fleeting Infatuation | Dynamic companion, loops from 8s |
| `recline-sample` | Purple Twilight Boots | Lazy Cuddle | Entrance, freeze-frame at 11.7s |

Each of the four sets includes a base video (1920×1080 / 60 FPS). The dynamic samples retain 10 continuous lines of dialogue, while other categories include a small selection of complete examples. Cover images, freeze-frame stills, and two scene backgrounds are provided separately.

## Creating Your Own Work

Begin by establishing a unique identity for your project. The first command displays the project plan; once you have reviewed the content, append `--apply` to execute it:

```powershell
python -X utf8 tools/project.py init --id my-companion --title "My Desktop Companion" --author "My Name"
python -X utf8 tools/project.py init --id my-companion --title "My Desktop Companion" --author "My Name" --apply
```

Follow the [Video Guide](docs/MEDIA.md) to swap in your own authorized assets, and refer to the [Dialogue Guide](docs/DIALOGUE.md) to modify the text. Project name, branding, character names, and default settings are all managed in `content/project.json`. Wardrobe categories, their order, and background settings are defined in `content/wardrobes.json`.

## Handing Off to a Local AI

Provide the repository folder to an AI capable of reading local files, and send the following prompt:

> Please begin by reading the README.md, AGENTS.md, and the relevant documentation in the `docs/` folder. I intend to create my own desktop companion using this template. Start by summarizing the four existing asset sets, the configuration entry points, and the current validation status. Then, proceed to modify the content based on the videos and dialogue I provide. Maintain the existing play/pause logic for the media player; if you require input from me—such as defining freeze-frames, loop points, or exit behaviors—please list the missing information. Once the modifications are complete, build the project, run the necessary checks, and provide me with a local preview link and the validation results. Do not upload any files, create remote repositories, or alter any other projects unless explicitly requested.

For specific task prompts, see [AI Task Examples](docs/AI_TASKS.md). For character creation materials, see the [Persona Template](docs/PERSONA.md).

## Reference Guides

- [Configuration & Architecture](docs/ARCHITECTURE.md): Explains the purpose of each file, stable IDs, and the save mechanism.
- [Video DIY](docs/MEDIA.md): Covers adding/replacing assets, exit behaviors, looping, cover images, and video quality.
- [Dialogue DIY](docs/DIALOGUE.md): Covers conversational exchanges, ongoing companionship, intimate interactions, and shared responses.
- [Testing & FAQ](docs/TESTING.md): Details automated checks and acceptance criteria for browser and desktop host environments. - [Publishing Your Work](docs/PUBLISH.md): Asset replacement checks, exporting for Wallpaper Engine/Lively, and open-sourcing your source code.
- [Verification Records](docs/VERIFICATION.md): Details on the actual verification performed and any limitations for this version.

## Development Environment

Adding or replacing video assets requires FFmpeg (with `ffmpeg` and `ffprobe` in your system PATH). You must also install Pillow—a dependency for processing screenshots—by running `python -m pip install -r requirements-media.txt`. This step is not required if you are simply building from existing sample assets. All tools are invoked using argument arrays; no commands embedded within input files are executed, and original video files are accessed in read-only mode. Files are backed up to the `.history` directory before any modifications are made.

Automated browser-based checks require Node.js 22.12+ and a local installation of Google Chrome:

```powershell
npm ci --ignore-scripts
npm test
npm run test:browser
```

`puppeteer-core` does not download a browser automatically. If Chrome is not installed in a standard location, use the `PURPLE_CHROME` environment variable to point to the executable file. These checks use an isolated configuration and do not read or clear your personal browser preferences.

These development tools are not required to run the wallpapers. Please ensure that `node_modules`, `.history`, `.qa`, or large raw video files are not included in your final wallpaper package.
