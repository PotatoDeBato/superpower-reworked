const dingSeconds = new Set([3, 2, 1, 0]);
const volumeStorageKey = "superpower_ready_volume";
const volumeSubfeature = utils.SubFeatures?.superpower_ready_volume_slider;

let volume = 50;

function normalizeVolume(nextVolume) {
	const parsedVolume = Number(nextVolume);
	if (!Number.isFinite(parsedVolume)) {
		return volume;
	}

	return Math.max(0, Math.min(100, parsedVolume));
}

function saveVolume(nextVolume) {
	volume = normalizeVolume(nextVolume);
	localStorage.setItem(volumeStorageKey, String(volume));
}

if (volumeSubfeature) {
	if (typeof volumeSubfeature.whenChanged === "function") {
		volumeSubfeature.whenChanged((Alpine) => {
			saveVolume(Alpine?.value ?? Alpine);
		});
	}

	if (localStorage.getItem(volumeStorageKey) === null && volumeSubfeature.value != null) {
		saveVolume(volumeSubfeature.value);
	}
}

const volumeTestButton = document.getElementById("superpower_ready_volume_test");
if (volumeTestButton) {
	volumeTestButton.addEventListener("click", () => {
		playDing();
	});
}

let lastAnnouncedSecond = null;
let lastLabelText = "";
let audioContext = null;

function getAudioContext() {
	if (audioContext) return audioContext;

	const Context = window.AudioContext || window.webkitAudioContext;
	if (!Context) return null;

	audioContext = new Context();
	return audioContext;
}

function getStoredVolume() {
	const rawVolume = localStorage.getItem(volumeStorageKey);
	if (rawVolume === null) {
		return normalizeVolume(volumeSubfeature?.value ?? volume);
	}

	const storedVolume = Number(rawVolume);
	if (Number.isFinite(storedVolume)) {
		return Math.max(0, Math.min(100, storedVolume));
	}

	return normalizeVolume(volumeSubfeature?.value ?? volume);
}

function playDing() {
	const context = getAudioContext();
	if (!context) return;

	const currentVolume = getStoredVolume();
	if (currentVolume <= 0) return;

	const volumeScale = Math.max(0, Math.min(1, currentVolume / 100));
	const peakGain = 0.14 * volumeScale;

	if (context.state === "suspended") {
		context.resume().catch(() => {});
	}

	const oscillator = context.createOscillator();
	const gainNode = context.createGain();

	oscillator.type = "sine";
	oscillator.frequency.setValueAtTime(1040, context.currentTime);
	oscillator.detune.setValueAtTime(0, context.currentTime);
	oscillator.frequency.exponentialRampToValueAtTime(1040, context.currentTime + 0.12);

	gainNode.gain.setValueAtTime(0.0001, context.currentTime);
	gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, peakGain), context.currentTime + 0.015);
	gainNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.18);

	oscillator.connect(gainNode);
	gainNode.connect(context.destination);

	oscillator.start();
	oscillator.stop(context.currentTime + 0.2);
	oscillator.onended = () => {
		oscillator.disconnect();
		gainNode.disconnect();
	};
}

function extractSeconds(labelText) {
	const match = labelText.match(/(\d+)\s*s\s*$/i);
	return match ? Number(match[1]) : null;
}

function handleSuperpowerLabelChange() {
	const label = document.getElementById("superpower-label");
	if (!label) return;

	const currentText = label.textContent.trim();
	if (currentText === lastLabelText) return;
	lastLabelText = currentText;

	const secondsLeft = extractSeconds(currentText);
	if (secondsLeft == null) {
		lastAnnouncedSecond = null;
		return;
	}

	if (!dingSeconds.has(secondsLeft)) return;
	if (lastAnnouncedSecond === secondsLeft) return;

	lastAnnouncedSecond = secondsLeft;
	playDing();
}

function observeLabel(label) {
	handleSuperpowerLabelChange();

	const observer = new MutationObserver(() => {
		handleSuperpowerLabelChange();
	});

	observer.observe(label, {
		childList: true,
		characterData: true,
		subtree: true
	});
}

function waitForLabel() {
	const label = document.getElementById("superpower-label");
	if (label) {
		observeLabel(label);
		return;
	}

	const observer = new MutationObserver(() => {
		const nextLabel = document.getElementById("superpower-label");
		if (!nextLabel) return;

		observer.disconnect();
		observeLabel(nextLabel);
	});

	observer.observe(document.documentElement, {
		childList: true,
		subtree: true
	});
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", waitForLabel, { once: true });
} else {
	waitForLabel();
}
