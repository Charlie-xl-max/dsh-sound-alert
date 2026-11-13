/**
 * Browser half of the sound-alert bundle.
 *
 * Watches the aggregated Session UI status that the shipped `dsh-client-ui-session`
 * plugin already publishes, and synthesizes two short chimes with Web Audio:
 *
 * - `pending`: some Session started waiting for the user (tool approval, question,
 *   plan review — every domain that publishes a pending interaction).
 * - `done`: a Session that was running stopped running, i.e. its turn closed.
 *
 * No audio files and no network requests: every note is generated with oscillators.
 */
window.__ModuleLoader__.load({
  id: 'dsh-sound-alert',
  factory() {
    'use strict'

    /** Tunables; edit and reload the page to change them. */
    const SETTINGS = {
      /** Play the attention chime when an interaction starts waiting for the user. */
      pending: true,
      /** Play the completion chime when a running turn closes. */
      done: true,
      /** Overall loudness: 0 = silent, 1 = the designed level; the compressor below keeps higher values clean. */
      volume: 1.8,
      /** Suppress repeats of the same chime closer together than this, in ms. */
      throttleMs: 700,
    }

    /**
     * Note table: `[frequency Hz, offset s, duration s, peak, timbre]`.
     * `bell` is a soft chime (fundamental plus two quiet partials); `sine` and
     * `triangle` are bare tones. Pending rises (asking for attention), done settles.
     */
    const PATTERNS = {
      pending: [
        [523.25, 0.0, 0.8, 0.30, 'bell'],
        [783.99, 0.16, 0.9, 0.24, 'bell'],
      ],
      done: [
        [1046.5, 0.0, 0.32, 0.44, 'sine'],
        [784.0, 0.135, 0.46, 0.38, 'sine'],
      ],
    }

    /** One AudioContext per page, created on first use and shared by both chimes. */
    function createPlayer(settings) {
      let context = null
      let output = null
      const lastPlayed = new Map()

      function audioContext() {
        if (context !== null) return context
        const AudioContextCtor = window.AudioContext || window.webkitAudioContext
        if (typeof AudioContextCtor !== 'function') return null
        try {
          context = new AudioContextCtor()
        } catch {
          context = null
        }
        return context
      }

      /**
       * Master chain: notes → bus → compressor → speakers. The compressor lets the
       * chimes be loud without the overlapping notes clipping on the way out.
       */
      function outputNode(target) {
        if (output !== null) return output
        const bus = target.createGain()
        const compressor = target.createDynamicsCompressor()
        const now = target.currentTime
        compressor.threshold.setValueAtTime(-12, now)
        compressor.knee.setValueAtTime(10, now)
        compressor.ratio.setValueAtTime(8, now)
        compressor.attack.setValueAtTime(0.003, now)
        compressor.release.setValueAtTime(0.25, now)
        bus.connect(compressor)
        compressor.connect(target.destination)
        output = bus
        return output
      }

      /** One synthesized voice with a short attack and an exponential decay. */
      function voice(target, frequency, waveform, startAt, duration, peak, attack) {
        const oscillator = target.createOscillator()
        const gain = target.createGain()
        oscillator.type = waveform
        oscillator.frequency.setValueAtTime(frequency, startAt)
        // Exponential ramps cannot touch zero, so the envelope floors at a tiny value.
        gain.gain.setValueAtTime(0.0001, startAt)
        gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), startAt + attack)
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)
        oscillator.connect(gain)
        gain.connect(outputNode(target))
        oscillator.start(startAt)
        oscillator.stop(startAt + duration + 0.03)
      }

      /**
       * A `bell` is a fundamental with two quieter partials that die away sooner,
       * which gives a soft chime instead of a bare, buzzy tone.
       */
      const BELL_PARTIALS = [
        [1, 1, 1, 0.02],
        [2, 0.2, 0.55, 0.012],
        [3, 0.07, 0.4, 0.008],
      ]

      function note(target, frequency, startAt, duration, peak, timbre) {
        if (timbre !== 'bell') {
          voice(target, frequency, timbre, startAt, duration, peak, 0.014)
          return
        }
        for (const [ratio, level, life, attack] of BELL_PARTIALS) {
          voice(target, frequency * ratio, 'sine', startAt, duration * life, peak * level, attack)
        }
      }

      function play(kind) {
        if (!Object.prototype.hasOwnProperty.call(PATTERNS, kind)) return false
        if (settings.volume <= 0) return false
        const now = Date.now()
        const previous = lastPlayed.get(kind) ?? 0
        if (now - previous < settings.throttleMs) return false
        const target = audioContext()
        if (target === null) return false
        if (target.state === 'closed') return false
        lastPlayed.set(kind, now)
        // Browsers may start the context suspended until the page sees a gesture.
        // Scheduling still queues the notes, and they sound once it resumes.
        if (target.state === 'suspended') {
          const resumed = target.resume()
          if (resumed && typeof resumed.catch === 'function') resumed.catch(() => {})
        }
        const base = target.currentTime + 0.02
        const gain = 0.5 * Math.min(Math.max(settings.volume, 0), 3)
        for (const [frequency, offset, duration, peak, timbre] of PATTERNS[kind]) {
          note(target, frequency, base + offset, duration, peak * gain, timbre)
        }
        return true
      }

      /**
       * Browsers gate audio until the page has seen a user gesture. Called from the
       * first pointer/key event so the context is already running when a chime is due,
       * instead of the chime being scheduled into a suspended context.
       */
      function unlock() {
        const target = audioContext()
        if (target === null) return false
        if (target.state === 'suspended') {
          const resumed = target.resume()
          if (resumed && typeof resumed.catch === 'function') resumed.catch(() => {})
        }
        return target.state === 'running' || target.state === 'suspended'
      }

      function close() {
        const target = context
        context = null
        output = null
        if (target === null || target.state === 'closed') return
        const closed = target.close()
        if (closed && typeof closed.catch === 'function') closed.catch(() => {})
      }

      return { play, unlock, close }
    }

    /** Whether `status` newly acquires a pending interaction relative to `before`. */
    function startsWaiting(before, status) {
      if (status === undefined || status.pendingInteraction === undefined) return false
      return before === undefined || before.pendingInteraction === undefined
    }

    return {
      inject: ['uiSession'],

      apply(ctx, config) {
        const overrides = config !== null && typeof config === 'object' ? config : {}
        const settings = { ...SETTINGS }
        if (typeof overrides.pending === 'boolean') settings.pending = overrides.pending
        if (typeof overrides.done === 'boolean') settings.done = overrides.done
        if (typeof overrides.volume === 'number') settings.volume = overrides.volume

        const player = createPlayer(settings)

        // Expose the player so other plugins (or a future settings panel) can trigger
        // or test the chimes: `ctx.soundAlert.play('pending' | 'done')`.
        try {
          ctx.provide('soundAlert', {
            play: kind => player.play(kind),
            playPending: () => player.play('pending'),
            playDone: () => player.play('done'),
            settings,
          })
        } catch {
          // A foreign `soundAlert` provision is not fatal; the chimes still run.
        }

        ctx.effect(() => {
          // Unlock audio on the first real interaction; see `unlock` in createPlayer.
          const gestures = ['pointerdown', 'keydown']
          const unlockOnGesture = () => {
            player.unlock()
            for (const type of gestures) window.removeEventListener(type, unlockOnGesture, true)
          }
          for (const type of gestures) window.addEventListener(type, unlockOnGesture, true)

          const status = ctx.uiSession.sessionStatus
          let previous = status.getSnapshot()
          const stop = status.subscribe(() => {
            const next = status.getSnapshot()
            let pendingStarted = false
            let finished = false
            for (const [sessionId, current] of next) {
              const before = previous.get(sessionId)
              if (startsWaiting(before, current)) pendingStarted = true
              if (current.running === false && before !== undefined && before.running === true) {
                finished = true
              }
            }
            previous = next
            // A turn that stops because it now waits for the user is an approval,
            // not a completion: the attention chime wins and only one plays.
            if (pendingStarted) {
              if (settings.pending) player.play('pending')
            } else if (finished && settings.done) {
              player.play('done')
            }
          })
          return () => {
            for (const type of gestures) window.removeEventListener(type, unlockOnGesture, true)
            stop()
            player.close()
          }
        }, 'sound-alert: Session status chimes')
      },
    }
  },
})
