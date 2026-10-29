# Dialogue DIY

For each outfit, modify only `content/looks/<id>/dialogue.json`; for global responses, edit `content/shared-dialogue.json`. Edit the files directly as UTF-8 JSON, or have an AI generate the file following the format below, then use the import command to validate it. You may use Markdown for drafting, but the system relies on JSON at runtime to ensure the parser doesn't have to guess the structure of arbitrarily formatted text.

## Basic Format

```json
{
"enabled": true,
"entries": [
{"id": "entry-1", "enter": "I wanted to see you a bit earlier today.", "held": "Now that I’m sitting here, there’s no rush to leave."}
],
"restored": [{"id": "restored-1", "text": "I’m still here—take your time."}],
"random": [{"id": "random-1", "text": "I’m wearing this outfit for you today."}],
"affectionScenes": [{"enter": "Let me get a little closer.", "held": "This is perfect."}]
}
```

The above is a structural example; you do not need to copy it verbatim. For every enabled outfit, you must provide at least one pair of "enter" and "held" lines, one "restored" line, and one "random" line. `affectionScenes` may be an empty array. | Field | Trigger Scenario |
| --- | --- |
| `entries[].enter` | Triggered when an outfit is selected, initiating the entry sequence. |
| `held` (within the same entry) | Follows the "freeze frame" point or the start of an animation loop; must transition seamlessly from the `enter` sequence. |
| `restored` | Used when returning to the current outfit (e.g., after resuming from a different state). |
| `random` | Triggered when this outfit is selected via a random choice. |
| `affectionScenes` | Replaces a standard entry line once a specific threshold of entry counts is reached for a "standard" (non-dynamic) outfit. |

For "dynamic" (animated) outfits, the following two arrays are also required:

```json
{
"continuous": [{"id": "continuous-1", "text": "Go ahead with what you're doing; I'll just keep you company here for a while.", "topic": "company"}],
"affection": [{"id": "affection-1", "text": "I really like being this close to you."}]
}
```

These are two additional fields to be included in the complete object; `restored`, `random`, and `entries` are still required. The initial set for "continuous" (ongoing companionship) dialogue consists of 10 entries, though this number can be adjusted as needed. The `topic` field is optional and is used to prevent the repetition of similar topics in sequence.

## Timing and Affection

By default, dynamic dialogue cycles every 30 seconds; this can be adjusted via `project.dialogueIntervalSeconds` (range: 5–3600 seconds). Only dialogue that is actually visible to the user contributes to the "affection" count. By default, after 5 lines of dialogue, the next cycle will trigger an `affection` line, after which the counter resets; this threshold is defined by `project.affectionAfter`. There is no additional cooldown period.

For "standard" (non-dynamic) outfits, an "affection" event is triggered after 4 uses of a specific entry point. Actions such as pausing, moving the app to the background, opening UI panels, or entering "immersive mode" will pause the dialogue timer. When the interface automatically collapses, "continuous" dialogue lines may update silently without consuming an "affection" opportunity. Do not attempt to modify dialogue frequency by shortening video clips or adding external timers.

## Adding, Removing, and Importing

Each `id` must be unique within a given outfit set. You may modify the text content of a line while keeping its existing `id`; new lines must be assigned a new `id`; to delete a line, simply remove the entire record. Do not map one set of dialogue lines to another based on card slot positions. Keep the "entry" (arrival) lines and the "held" (interaction) lines within the same object to ensure the lengths of the corresponding arrays remain synchronized.

```powershell
python -X utf8 tools/project.py dialogue --id sit-companion --file "new_dialogue.json"
python -X utf8 tools/project.py dialogue --id sit-companion --file "new_dialogue.json" --apply
python -X utf8 tools/project.py check
python -X utf8 tools/project.py build
```

The importer only replaces dialogue for the specified outfit; it performs validation and creates a backup before writing, leaving video files and other outfits untouched. Alternatively, you can edit the original files directly and then run the check command.

If you wish to temporarily disable dialogue, set the file content to `{"enabled":false}`. This will clear any previously displayed lines for that set and deactivate the dialogue, though it will not mute the video itself.

Shared action responses include: favorite, unfavorite, replay, pause, resume, select frame, save, cancel, resume from freeze, and wake up. Keep these keys in `shared-dialogue.json`; if you do not wish to provide a response for a specific action, you may use an empty array. The `fixed` key is for short phrases, such as those used when toggling playback modes. Please ensure that any example text within these fields is replaced before publication.

When writing, refer to `PERSONA.md` and focus on the specific scenario—"accompanying the user in this particular state"—while maintaining a sense of natural interaction. The character, their relationship with the user, and the specific phrasing are entirely up to the creator; the code does not mandate the use of the example persona.
