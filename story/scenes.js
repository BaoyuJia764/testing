(() => {
  const scenes = [
    {
      id: 'atrium-opening',
      stageId: 'atrium',
      trigger: 'beforeEncounter',
      title: 'A sound below the water',
      backgroundUrl: null,
      requiredFlags: [],
      dialogue: [
        { speaker: 'Mira Vale', text: 'The signal is coming from beneath the flooded tiles.' },
        { speaker: 'Orin Reed', text: 'Then we follow it carefully. Something is answering.' },
      ],
    },
    {
      id: 'atrium-clear',
      stageId: 'atrium',
      trigger: 'afterWin',
      title: 'The signal fades',
      backgroundUrl: null,
      requiredFlags: ['atrium-cleared'],
      dialogue: [
        { speaker: 'Sable Yoon', text: 'The water is still now. I can hear the machinery settling.' },
      ],
    },
  ];

  window.StoryScenes = {
    scenes,
    find(stageId, trigger, flags = {}) {
      return [...(window.LOCAL_STORY_SCENES || []), ...scenes].find((scene) => scene.stageId === stageId
        && scene.trigger === trigger
        && scene.dialogue?.length
        && scene.requiredFlags.every((flag) => flags[flag]));
    },
  };
})();