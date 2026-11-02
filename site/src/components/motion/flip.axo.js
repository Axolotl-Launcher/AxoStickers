// 内置动作「空翻」：就是「跳水」打开了空翻。
component({
  id: 'flip', type: 'motion', name: '空翻', extends: 'jump',
  params: { flip: { label: '空翻', type: 'bool', default: 1 } },
});
