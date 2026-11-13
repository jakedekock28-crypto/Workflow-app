import type { MessageTemplate, Person, Task } from '../../types';

export interface MessageValues {
  PersonName: string;
  TaskTitle: string;
  TaskDescription: string;
  Requirements: string;
  DueDate: string;
  Priority: string;
  AssignedBy: string;
}

export interface RenderedMessage {
  emailSubject: string;
  emailBody: string;
}

export const defaultMessageTemplate: MessageTemplate = {
  id: 'default-reminder',
  name: 'Task reminder',
  emailSubject: 'Task: {TaskTitle}',
  emailBody: 'Hi {PersonName},\n\n{AssignedBy} has assigned you a task.\n\nTask: {TaskTitle}\nDetails: {TaskDescription}\nRequirements: {Requirements}\nDue: {DueDate}\nPriority: {Priority}\n\nPlease reply if you have any questions.',
};

export function createMessageValues(task: Task, person: Person, assignedBy = 'Workflow user'): MessageValues {
  const requirements = task.requirements.map(item => item.title).filter(Boolean).join(', ') || 'None';
  const due = task.dueTime ? `${task.dueDate} at ${task.dueTime}` : task.dueDate;
  return {
    PersonName: person.fullName,
    TaskTitle: task.title,
    TaskDescription: task.description || 'No additional details',
    Requirements: requirements,
    DueDate: due,
    Priority: task.priority,
    AssignedBy: assignedBy,
  };
}

export function renderTemplate(template: string, values: MessageValues): string {
  return template.replace(/\{(PersonName|TaskTitle|TaskDescription|Requirements|DueDate|Priority|AssignedBy)\}/g, (_, key: keyof MessageValues) => values[key]);
}

export function renderMessage(template: MessageTemplate, values: MessageValues): RenderedMessage {
  return {
    emailSubject: renderTemplate(template.emailSubject, values),
    emailBody: renderTemplate(template.emailBody, values),
  };
}
