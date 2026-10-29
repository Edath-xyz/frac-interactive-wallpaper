# Examples of Tasks for Local AI

Set the current repository folder as your working directory. Replace the file paths, timestamps, and names below with your actual input data. Do not rely on the AI ​​to guess details about your new video based on the provided examples.

## Adding a New Dynamic Companion

> First, read `README.md`, `AGENTS.md`, and `docs/MEDIA.md`. Add the video I’ve provided as a dynamic companion with the ID `my-companion-01`. Place it in the "sit" (sitting) wardrobe category and name it "My Companion." Set the loop to start at the 8-second mark (as specified) and end at the conclusion of the video. Do not modify the existing four sets. Verify the actual duration of the video against the parameters, then use the `project.py` planning and `apply` workflow to integrate it. Since I haven't provided dialogue yet, explicitly disable the dialogue component for this set. Once finished, verify the assets and playback, generate a local preview, and confirm that the original video file remains unchanged.

## Replacing an Existing Sample

> Following the instructions in `docs/MEDIA.md`, replace the video in the `classic-sample` set with the file I’ve provided, using the specified timestamp as the "freeze-frame" (still-image) point. Retain the existing ID and `hostValue`. Regenerate the cover image and the recommended freeze-frame, and remove any references to the previous video quality/settings. Keep the original dialogue file for now, but explicitly note that it remains part of the restricted sample content. Do not publish or alter any other projects. Once complete, run the media check and build process.

## Writing and Integrating Dialogue

> Read `docs/DIALOGUE.md`, `docs/PERSONA.md`, and the `look.json` file for the target outfit. Based on the character, outfit, and context I’ve provided, draft the following: two pairs of entry/response lines, 10 lines for ongoing companionship, 2 lines for "resumption" (re-engaging), 2 random lines, and 2 lines for occasional, low-frequency affectionate remarks. Ensure the tone is natural and interactive—avoid a mundane, play-by-play account of daily life. Assign a unique ID to each line, following the format of the target `dialogue.json` file; do not alter any previously approved text. After confirming the scope of these changes, integrate them according to the existing authorization protocols. Modify only this specific dialogue set, then run the `check` and `build` commands.

## Adjusting the Wardrobe

> Refer to `docs/ARCHITECTURE.md` to adjust the names and default display order of the wardrobe categories. Retain the existing ID, `hostValue`, and video content for each set; do not change the directory structure or identity of the sets to achieve the desired sorting order. Verify that each set appears exactly once and that the default configuration is valid; also check forward and reverse playback sequences, as well as the restoration of previously saved states.

## Publishing Your Own Work

> Refer to `docs/PUBLISH.md` to ensure your project does not contain any remaining template samples, placeholder images, or example dialogue—list any items that have not yet been replaced. Once all replacements are complete and final checks are performed, export the project as WE (Wallpaper Engine) and Lively packages into the `dist` directory. Use a new package name, and include a manifest along with a local entry point. The code is licensed under 0BSD; there is no requirement to provide attribution, watermarks, or promotional links to the original author. Third-party components remain subject to their respective licenses. Do not copy the original author’s Workshop ID, and do not upload, push, or modify my existing host configuration. Clearly document the scope of actual testing performed and any host-specific acceptance criteria that remain unfulfilled.

## Modifying the Player

> Begin by reproducing the specific issue I have described—document the triggering actions, video type, video quality, and layout—before making the minimum necessary modifications within `src/player`. Maintain support for dual video streams, token-less access, the distinction between manual and system-initiated pauses, and stable identifiers. Add a test case that reproduces the issue; do not alter the expected behavior simply to pass a test. Upon completion, provide an explanation of the actual changes made and the results of regression testing.
