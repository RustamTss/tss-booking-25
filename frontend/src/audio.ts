// Small audio helper to play short notification sounds
// Files must exist in src/assets/audio/
import bookingUrl from './assets/audio/booking.mp3'
import goneUrl from './assets/audio/gone.mp3'
import readyUrl from './assets/audio/ready.mp3'
import requestUrl from './assets/audio/request.mp3'

type NamedAudio = {
	name: string
	el: HTMLAudioElement
}

const sounds: Record<'booking' | 'ready' | 'gone' | 'request', NamedAudio> = {
	booking: { name: 'booking', el: new Audio(bookingUrl) },
	ready: { name: 'ready', el: new Audio(readyUrl) },
	gone: { name: 'gone', el: new Audio(goneUrl) },
	request: { name: 'request', el: new Audio(requestUrl) },
}

for (const key of Object.keys(sounds) as Array<keyof typeof sounds>) {
	sounds[key].el.preload = 'auto'
	sounds[key].el.volume = 0.6
}

function play(sound: keyof typeof sounds): void {
	const a = sounds[sound].el
	try {
		a.currentTime = 0
		// Play in a microtask to avoid potential React event batching interference
		Promise.resolve().then(() => a.play().catch(() => void 0))
	} catch {
		/* ignore */
	}
}

export function playBookingSound(): void {
	play('booking')
}
export function playReadySound(): void {
	play('ready')
}
export function playGoneSound(): void {
	play('gone')
}
export function playRequestSound(): void {
	play('request')
}
