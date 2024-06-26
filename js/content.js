// Create a style tag for hiding and showing the real timer button
document.head.insertAdjacentHTML('beforeend', '<style id="zorua-timer-hiding">.timerbutton:not(:hover) {} .timerbutton { width: 70px; } .zoruaFakeTimerButton { float: right; text-decoration: line-through; width: 70px; } .zoruaFakeTimerButton:not(:hover) { filter: brightness(0); }</style>');
const timerHidingCSSRule = Array.from(document.styleSheets).find(sheet => sheet.ownerNode.id === "zorua-timer-hiding").cssRules[0];

const BattleState = {
    PRE_TURN_1: Symbol("PRE_TURN_1"), // Battle has started but it's still not turn 1 (i.e. leads haven't finished going out)
    STARTED: Symbol("STARTED")
}
const startedBattles = new Map(); // Map of battles that have started so we don't mess with replays and aren't fooled by fake replay controls that appear first

// Identify which state a battle is in:
// - Not started
// - Turn in progress
// - Between turns
// - Ending
// - Ended [at which point the observer should be killed so we don't revert]
function identifyBattleState(controls) {
    if (controls.querySelector(".timerbutton")) {
        if (!startedBattles.has(controls)) startedBattles.set(controls, BattleState.PRE_TURN_1); // Once we see the timer, we're at least in pre-start

        if (controls.querySelector('[name="skipTurn"]')) {
            return "turnInProgress";
        } else {
            if (controls.parentElement.querySelector(".turn")) startedBattles.set(controls, BattleState.STARTED); // Once we see the turn counter alongside the user's controls, the battle has fully started
            return "betweenTurns";
        }
    } else {
        if (startedBattles.has(controls)) {
            if (controls.querySelector('.replayDownloadButton')) {
                return "ended";
            } else {
                return "ending";
            }
        }
        return "not started";
    }
}

// Observer that looks for battle controls and starts an observer for each one
const globalObserver = new MutationObserver(mutations => mutations.forEach(mutation => {
    if (mutation.addedNodes && mutation.addedNodes.length > 0) {
        [].forEach.call(mutation.addedNodes, elem => {
            // Check if the added node or any of its children has the battle-controls class
            if (elem.nodeType === Node.ELEMENT_NODE) { // Text nodes aren't what we're looking for and will error on querySelector
                const controls = elem.classList != null && elem.classList.contains('battle-controls') ? elem : elem.querySelector('.battle-controls');
                if (controls) {
                    observeBattleControls(controls);
                }
            }
        });
    }
}));
// Observe for new battle controls
globalObserver.observe(document.body, { childList: true, subtree: true });
// Check for existing battle controls (e.g. in case of page reload)
addEventListener("load", _ => setTimeout(() => [...document.getElementsByClassName('battle-controls')].forEach(observeBattleControls), 500));


function createFakeTimerButton(controls) {
    // Place the fake timer button before the "Skip turn" button
    const sibling = controls.querySelector('[name="skipTurn"]');
    // Delete any previously-existing fake buttons
    controls.querySelectorAll('.zoruaFakeTimerButton').forEach(button => button.remove());
    // Create the new fake button
    sibling.insertAdjacentHTML('beforebegin', '<button disabled name="openTimer" class="button zoruaFakeTimerButton"><i class="fa fa-hourglass-start"></i> Timer</button>');
    controls.querySelector('.zoruaFakeTimerButton').addEventListener('click', event => event.stopPropagation(), true); // Disable clicking
}


function observeBattleControls(controls) {
    const controlsObserver = new MutationObserver(mutations => mutations.forEach(mutation => {
        const state = identifyBattleState(controls);
        // If a turn is in progress, black out the real timer button
        // Unless we're pre-start (i.e. in the animation of an automatic lead being sent out), in which case there's no spoiler risk and people like to turn on the timer then
        if (state == "turnInProgress" && startedBattles.get(controls) != BattleState.PRE_TURN_1) {
            timerHidingCSSRule.style.setProperty("filter", "brightness(0)", "important");
        }
        // If the battle is in between turns, stop hiding the timer
        else if (state == "betweenTurns") {
            timerHidingCSSRule.style.removeProperty("filter");
        }
        // If the battle is ending, hide all spoilers
        else if (state == "ending") {
            // Make the "Skip turn" button look normal
            controls.querySelector('[name="skipTurn"]').classList.remove('button-last');
            controls.querySelector('[name="skipTurn"]').removeAttribute('style');
            // Make the "Go to end" button look normal
            controls.querySelector('[name="goToEnd"]').classList.remove('button-last');
            // Add space between the "Skip turn" and "Go to end" buttons
            controls.querySelector('[name="skipTurn"]').insertAdjacentText("afterend", " ");
            // Delete the "Pause", "First turn", and "Prev turn" buttons
            [...controls.querySelectorAll('[name="rewindTurn"], [name="instantReplay"], [name="pause"]')].forEach(button => button.remove());
            // Delete the "Switch viewpoint" button
            controls.querySelector('p > [name="switchViewpoint"]')?.parentElement.remove();
            // Make a fake disabled timer button
            createFakeTimerButton(controls);
        }
        // If the battle ended, clean up the observer (so we don't mess with controls during instant replay)
        else if (state == "ended") {
            controlsObserver.disconnect();
        }
        // If the battle hasn't started do nothing
    }));
    identifyBattleState(controls); // Check if the battle is active when the controls first appear, so we don't misreport a battle as "not started" the first time it mutates
    controlsObserver.observe(controls, { childList: true });
}
