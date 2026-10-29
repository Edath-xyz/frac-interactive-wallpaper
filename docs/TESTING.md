# Checks and FAQ

## Check Sequence

```powershell
python -X utf8 tools/project.py doctor
python -X utf8 tools/project.py check
python -X utf8 tools/project.py check --media
python -X utf8 tools/project.py build --host both
python -X utf8 -m unittest discover -s tests -p "test_*.py" -v
```

The `check` command validates IDs, default variants, groupings, duplicate numbering, file paths, time ranges, the existence of media assets, and dialogue pairing. `check --media` goes further, using `ffprobe` to read actual frame counts, resolutions, encodings, durations, and frame rates; however, it does not scan for black frames, nor can it determine whether the motion is suitable for looping.

The Python test suite copies the project into a temporary directory (with Chinese characters/spaces in the path) under `.qa`, generates test videos, and verifies core functionality: adding/replacing assets, dialogue, image quality, deletion, packaging, and rebuilding from the source. Your original `content` remains unmodified. The media workflow requires FFmpeg and the `Pillow` library (listed in `requirements-media.txt`); if dependencies are missing, tests will be marked as "skipped"—do not mistake "skipped" for "passed."

Browser-based tests:

```powershell
npm ci --ignore-scripts
npm run test:browser
```

This process reads your current configuration and opens the local HTML file using a dedicated Chrome profile. It performs actual video decoding to verify features such as initial freeze-frames, dynamic loops, wardrobe-switching (preview mode), sorting, the "compact" layout, and the pause notifications for specific page adaptations. Logs and screenshots are saved in `.qa/browser-<timestamp>`. Note that this is not a native validation for WE (Wallpaper Engine) or Lively Desktop; it does not test actual audio playback or performance smoothness across all hardware.

Final manual check: After importing the project into the target software, play each type of asset. Test system behavior following manual pauses, returning from a locked screen, clicking on the desktop, adjusting volume, and ensuring compatibility with your specific screen aspect ratio. Re-verify whenever you change the decoder or the host software version.

## FAQ

**The HTML displays a black screen or is missing a cover image:** Ensure you have run the `build` command, then open the `index.html` file located within the full directory under `preview`—do not simply copy an individual HTML file. Run `check` to identify any missing file paths. The four WebM files in the repository are actual assets; if they are missing after a pull, please restore the original files rather than creating empty placeholder files to bypass validation.

**Video has visuals but no sound**: Check if the source video contains an audio track, and verify the page volume and mute settings. Note that browsers may require a user interaction (a click) before audio can play. Ensure that the audio is audible within the actual host environment, not just the web page itself.

**Loop restarts from the beginning every time**: Confirm that the `kind` is set to `companion`, that `loopStart` and `loopEnd` are correctly configured, and that the mode is set to "dynamic companion." A standard loop mode will replay the entire video from the start; this is a different behavior.

**Unnatural loop transitions**: The tool can only validate time ranges. Manually check the pose, gaze, lighting, and motion continuity between the start and end points; do not attempt to mask issues by simply adding delays to the dialogue.

**Changes to JSON not reflected**: Rebuild the project and restart the preview; do not edit the preview files directly. It is normal for settings to persist even if a name is changed, as the "work ID" is what uniquely identifies the asset.

**Mapping errors after deleting an entry**: The system automatically remaps entries based on `catalogIds`. Do not delete saved mappings or reuse old IDs/`hostValue` entries. Avoid clearing all settings as a "default" fix.

**Quality button does not show 4K**: The "original" label refers to the base video file; the button displays the actual resolution of that base file. The sample assets provided in this template are 1080p. Options for higher resolutions will only appear once you add actual high-resolution files.

**`ffmpeg`/`ffprobe` not found**: Install FFmpeg, add its `bin` directory to your system PATH, and restart your terminal. While the project can still build using the existing samples, these tools are required for adding/replacing assets and performing media validation.

**Chrome fails to launch**: Verify your Node.js version and ensure `npm ci` completed successfully. Use the `PURPLE_CHROME` environment variable to point to your Chrome executable. In restricted environments, you may need to grant permission to launch isolated test processes; do not use your personal browser profile path for testing.

**HTTP validation required**: Run `node tools/serve.cjs`. This will listen on a random local port and output the access URL; it supports HTTP Range requests for video. You can specify a different build directory by setting `PURPLE_HOST=lively`. Do not use a basic server that lacks `Range` request support to verify if the output is rendered correctly; press `Ctrl+C` to shut down the server when finished.

**Prohibition on using sample assets in published builds:** Replace any restricted content as per `CONTENT-LICENSE.md`. Do not alter the fingerprints of sample assets or attempt to bypass restrictions by including the `demo` package. For previewing/learning purposes only, you may use the `pack --demo` command.

**Recovering from an accidental change:** Check the backups located in `.history/<timestamp>/content`. Before proceeding, compare the relevant `look` folder, `wardrobes.json`, and `project.json` files. Once the configuration has been properly restored, run `check` or `build` again. Ensure that you do not overwrite newer, intentional modifications with older backup files.
