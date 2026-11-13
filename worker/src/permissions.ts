export type WorkspaceRole = 'owner' | 'admin' | 'delegator' | 'member';
export type Permission =
  | 'workspace:read' | 'workspace:update' | 'workspace:delete' | 'member:manage'
  | 'invite:create' | 'invite:revoke' | 'task:list_all' | 'task:create'
  | 'task:update_any' | 'task:update_assigned' | 'task:delete' | 'task:delete_own' | 'data:manage'
  | 'audit:read' | 'export';

export const permissionMap: Record<WorkspaceRole, readonly Permission[]> = {
  owner: ['workspace:read', 'workspace:update', 'workspace:delete', 'member:manage', 'invite:create', 'invite:revoke', 'task:list_all', 'task:create', 'task:update_any', 'task:update_assigned', 'task:delete', 'data:manage', 'audit:read', 'export'],
  admin: ['workspace:read', 'workspace:update', 'member:manage', 'invite:create', 'invite:revoke', 'task:list_all', 'task:create', 'task:update_any', 'task:update_assigned', 'task:delete', 'data:manage', 'audit:read'],
  delegator: ['workspace:read', 'task:create', 'task:update_assigned', 'task:delete_own'],
  member: ['workspace:read', 'task:update_assigned'],
};

export function can(role: WorkspaceRole, permission: Permission): boolean {
  return permissionMap[role].includes(permission);
}
