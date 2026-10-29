# Distribution and Source Code Sharing

## Distinguishing Between Package Types

- `source`: A source code package containing code, tools, documentation, and templates for four sample projects. Please retain the `LICENSE`, `CONTENT-LICENSE.md`, and `NOTICE.md` files.
- `pack`: A distribution package for your own wallpaper project. By default, the tools will check for the presence of sample content; the `--demo` flag is intended solely for local previewing and must not be used for public distribution.

The four sample projects provided are for learning and preview purposes only. You are not authorized to redistribute these assets as part of your own work. The 0BSD license applies only to the code and development documentation; it does not grant rights to the included assets.

## Creating Your Distribution Package

1. Use the `init` command to set a unique `id`, title, and author name. Customize the branding, character names, and descriptions to suit your project. Ensure this is done before your initial release, and maintain the same project ID for any subsequent updates.
2. Replace the four sets of videos, cover images, static frames, background images, and all dialogue (both set-specific and shared). You may also delete any sample sets you do not intend to use. Ensure that you have the legal right to distribute all content you include.
3. Verify that `sample: false` is set in all `look.json` files. Once all sample content has been removed, set `sample` to `false` in `content/project.json`. Simply changing this flag is not a substitute for replacing the actual assets; the tools will verify the registered files and dialogue fingerprints.
4. Review the content rating and other host-specific properties for Wallpaper Engine (WE). The template configuration is located at `src/hosts/wallpaper-engine.json` and does not include the original author's Workshop ID. Please select the appropriate content rating based on your actual content; the template does not determine this for you.
5. Follow the instructions in `TESTING.md` to perform checks and preview your project within the target wallpaper software. Confirm that the cover image, audio, scaling, and looping behavior all function as expected.
```powershell
python -X utf8 tools/project.py check --media
python -X utf8 tools/project.py pack --host wallpaper-engine --name my-wallpaper-we-v1
python -X utf8 tools/project.py pack --host lively --name my-wallpaper-lively-v1
```
Each ZIP file contains the entry point and host-specific metadata directly in its root directory, without any additional nested folders. A `manifest` file is included, listing all files along with their SHA256 checksums. Existing packages with the same name will not be overwritten; please use a new package name when releasing an update.

WE (Wallpaper Engine): Extract the new package and create a new "Web" wallpaper in the Wallpaper Engine editor, pointing to `index.html`. Verify the title, cover image, and properties before publishing manually. New projects are assigned a unique Workshop ID by the host platform; you cannot reuse or copy another user's `workshopid`. When updating your own existing work, ensure you use your original project and Workshop ID. This tool does not handle the upload process, nor does it overwrite the directories currently in use by the host application.

Lively: Select the ZIP file via the "Add Wallpaper" option; the entry point for metadata is `LivelyInfo.json`. The package contains only the wallpaper content—it does not include the Lively software, the installer, or user-specific configurations.

The code is licensed under 0BSD. When creating and publishing your own work, you are not required to provide attribution, mention the original author, add watermarks, or include links back to the original project. Furthermore, you are not obligated to retain the copyright notice or license text from this project in your derivative source code or distributed packages. A copy of the license is included with the tool for your reference; however, any third-party components remain subject to their respective licenses.

Creators are solely responsible for their derivative works, including any new content, rights to the assets used, publication, ongoing management, and user support. The use of this project's code does not imply that the original author has participated in, produced, collaborated on, or endorsed your work. You should define your own licensing terms for the assets you include; the asset information provided in this template applies only to the template's example content and does not constitute a licensing guarantee for any new assets you add.

## Sharing the Template Source Code

This template is hosted in a repository named `frac-interactive-wallpaper`, with the display title: "FRAC_Interactive Desktop Wallpaper · Open-Source DIY Template." The name of the wallpaper as it appears in the host application is controlled by the `title` field in `content/project.json`; it is currently set to "FRAC_桌面互动壁纸" (FRAC_Desktop Interactive Wallpaper).

```powershell
python -X utf8 tools/project.py source
```

This command generates `dist/purple-diy-source.zip`. The tool includes only explicitly referenced source entry points, development documentation, tools, and assets cited in the configuration. It excludes `.git`, `.history`, `.qa`, `node_modules`, preview files, exported packages, and unreferenced raw video files. You should still manually verify that any new source code or documentation does not contain private information.

This template does not include the Git history or remote repository references from the original project. When creating your own public repository, start from this standalone directory, review the `.gitignore` file, and ensure that the video files are actual files—rather than local hard links or pointers to missing large files—before committing. If the number of assets grows and the repository becomes too large, you may implement a separate asset-downloading solution; the initial version, containing four sample clips, does not require dependencies on external drives or volumes.

Publishing to a remote repository, pushing, and uploading are separate, deliberate actions. The build and packaging commands in this template do not perform these operations.
