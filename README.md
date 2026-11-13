# Sound alerts for DeepSeek Harness

A small DeepSeek Harness (DSH) Web UI plugin that plays a chime when the agent
needs you:

- **Waiting for you** — a soft two-note bell rising a perfect fifth (C5 → G5)
  when a Session starts waiting for your input: a tool approval, an
  `ask_user_question` prompt, or a plan review.
- **Finished** — a descending two-note chime when a running turn stops.

![A bell with sound waves next to a green check mark](docs/preview.svg)

Everything is synthesized with the Web Audio API at play time: the plugin ships
no audio files, makes no network requests, and has no dependencies or build
step.

## Install

The folder is the complete plugin; installing it never touches the DSH
installation itself.

**From a local folder**

1. Put the `sound-alert` folder somewhere permanent (unzip a release archive if
   needed — keep the folder itself).
2. In DSH, open **Plugins** and choose **Add plugin**, then select the folder.
3. Make sure the plugin row is enabled, then reload the Web page (`Ctrl+R`).

**From a git clone**

```sh
git clone https://github.com/Charlie-xl-max/dsh-sound-alert.git
```

Then follow the three steps above with the cloned folder.

The same package can be installed from a `.tgz` tarball URL, or from a local
path with the `plugin_manager` tool (`install_bundle` and the folder's absolute
path).

Requirements: a DSH build whose Web UI ships the Client `uiSession` service.
The standard Web app does.

## How it decides

The plugin subscribes to `ctx.uiSession.sessionStatus`, the aggregated status
map the shipped Session UI plugin already maintains from Host
`api-session/status` events. Each published status carries `running` and
`pendingInteraction`, so a chime plays when one of those transitions:

- `pendingInteraction` goes from absent to present → waiting chime
- `running` goes from `true` to `false` → finished chime

A turn that stops running because it is now waiting for you counts as waiting,
not finished, so only the waiting chime plays. A chime never repeats more often
than once per `throttleMs`.

## Tuning

The `SETTINGS` block at the top of [`client.js`](client.js) holds the knobs:

| Key | Meaning |
| --- | --- |
| `pending` | Enable the waiting chime |
| `done` | Enable the finished chime |
| `volume` | `0`..`3` loudness multiplier, default `1.8` |
| `throttleMs` | Minimum gap between two chimes of the same kind |

The note patterns are the `PATTERNS` table just below it: `[frequency Hz, offset
s, duration s, peak, timbre]`, where `timbre` is `bell`, `sine`, or `triangle`.
Reload the page (`Ctrl+R`) after editing.

Other plugins can trigger a chime through the exposed Client service:
`ctx.soundAlert.play('pending')` or `play('done')`.

## Limits

- Only rings while a DSH Web page is open; a closed window plays nothing.
- A muted system volume or a muted tab keeps it silent.
- Browsers can start the audio context suspended until the page sees a click or
  key press; the plugin unlocks it on your first interaction, so later chimes
  sound normally.

## License

MIT — see [LICENSE](LICENSE).
