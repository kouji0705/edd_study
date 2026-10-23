export type OrderTask = {
  name: string;
  run: (schedule: (task: OrderTask) => void) => void;
};

export function runAsStack(tasks: readonly OrderTask[]): string[] {
  const pending = [...tasks];
  const names: string[] = [];
  const runTask = (task: OrderTask): void => {
    names.push(task.name);
    task.run((child) => {
      runTask(child);
    });
  };
  for (const task of pending) {
    runTask(task);
  }
  return names;
}

export function runAsQueue(tasks: readonly OrderTask[]): string[] {
  const queue = [...tasks];
  const names: string[] = [];
  while (queue.length > 0) {
    const task = queue.shift();
    if (task === undefined) {
      break;
    }
    names.push(task.name);
    task.run((child) => {
      queue.push(child);
    });
  }
  return names;
}
