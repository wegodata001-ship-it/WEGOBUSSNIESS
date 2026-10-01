export const collections = {
  users: "users",
  businesses: "businesses",
} as const;

export const businessCollections = {
  members: "members",
  employees: "employees",
  departments: "departments",
  projects: "projects",
  tasks: "tasks",
  comments: "comments",
  meetings: "meetings",
  workSessions: "workSessions",
  logisticsRequests: "logisticsRequests",
  notifications: "notifications",
  notificationDeliveries: "notificationDeliveries",
  activityLogs: "activityLogs",
  settings: "settings",
  documents: "documents",
  payments: "payments",
  paymentAllocations: "paymentAllocations",
  departmentCategories: "departmentCategories",
  clients: "clients",
  businessDocs: "businessDocs",
  termsTemplates: "termsTemplates",
  serviceItems: "serviceItems",
  taskTemplates: "taskTemplates",
  taskStatuses: "taskStatuses",
  movements: "movements",
} as const;

export function userDocPath(userId: string) {
  return `${collections.users}/${userId}`;
}

export function userMembershipsPath(userId: string) {
  return `${userDocPath(userId)}/memberships`;
}

export function userMembershipDocPath(userId: string, businessId: string) {
  return `${userMembershipsPath(userId)}/${businessId}`;
}

export function businessDocPath(businessId: string) {
  return `${collections.businesses}/${businessId}`;
}

export function businessScopedPath(businessId: string, collectionName: string) {
  return `${businessDocPath(businessId)}/${collectionName}`;
}

export function businessMembersPath(businessId: string) {
  return businessScopedPath(businessId, businessCollections.members);
}

export function memberDocPath(businessId: string, userId: string) {
  return `${businessMembersPath(businessId)}/${userId}`;
}

export function employeesPath(businessId: string) {
  return businessScopedPath(businessId, businessCollections.employees);
}

export function employeeDocPath(businessId: string, employeeId: string) {
  return `${employeesPath(businessId)}/${employeeId}`;
}

export function departmentsPath(businessId: string) {
  return businessScopedPath(businessId, businessCollections.departments);
}

export function departmentDocPath(businessId: string, departmentId: string) {
  return `${departmentsPath(businessId)}/${departmentId}`;
}

export function departmentCategoriesPath(businessId: string) {
  return businessScopedPath(businessId, businessCollections.departmentCategories);
}

export function departmentCategoryDocPath(businessId: string, categoryId: string) {
  return `${departmentCategoriesPath(businessId)}/${categoryId}`;
}

export function projectsPath(businessId: string) {
  return businessScopedPath(businessId, businessCollections.projects);
}

export function projectDocPath(businessId: string, projectId: string) {
  return `${projectsPath(businessId)}/${projectId}`;
}

export function tasksPath(businessId: string) {
  return businessScopedPath(businessId, businessCollections.tasks);
}

export function taskDocPath(businessId: string, taskId: string) {
  return `${tasksPath(businessId)}/${taskId}`;
}

export function taskCommentsPath(businessId: string, taskId: string) {
  return `${taskDocPath(businessId, taskId)}/${businessCollections.comments}`;
}

export function taskActivityPath(businessId: string, taskId: string) {
  return `${taskDocPath(businessId, taskId)}/activity`;
}

export function meetingsPath(businessId: string) {
  return businessScopedPath(businessId, businessCollections.meetings);
}

export function meetingDocPath(businessId: string, meetingId: string) {
  return `${meetingsPath(businessId)}/${meetingId}`;
}

export function workSessionsPath(businessId: string) {
  return businessScopedPath(businessId, businessCollections.workSessions);
}

export function workSessionDocPath(businessId: string, sessionId: string) {
  return `${workSessionsPath(businessId)}/${sessionId}`;
}

export function logisticsRequestsPath(businessId: string) {
  return businessScopedPath(businessId, businessCollections.logisticsRequests);
}

export function logisticsRequestDocPath(businessId: string, requestId: string) {
  return `${logisticsRequestsPath(businessId)}/${requestId}`;
}

export function notificationsPath(businessId: string) {
  return businessScopedPath(businessId, businessCollections.notifications);
}

export function notificationDocPath(businessId: string, notificationId: string) {
  return `${notificationsPath(businessId)}/${notificationId}`;
}

export function notificationDeliveriesPath(businessId: string) {
  return businessScopedPath(businessId, businessCollections.notificationDeliveries);
}

export function notificationDeliveryDocPath(businessId: string, deliveryId: string) {
  return `${notificationDeliveriesPath(businessId)}/${deliveryId}`;
}

export function businessNotificationSettingsPath(businessId: string) {
  return businessSettingsDocPath(businessId, "notifications");
}

export function activityLogsPath(businessId: string) {
  return businessScopedPath(businessId, businessCollections.activityLogs);
}

export function activityLogDocPath(businessId: string, logId: string) {
  return `${activityLogsPath(businessId)}/${logId}`;
}

export function businessSettingsPath(businessId: string) {
  return businessScopedPath(businessId, businessCollections.settings);
}

export function businessSettingsDocPath(businessId: string, docId = "general") {
  return `${businessSettingsPath(businessId)}/${docId}`;
}

export function documentsPath(businessId: string) {
  return businessScopedPath(businessId, businessCollections.documents);
}

export function documentDocPath(businessId: string, documentId: string) {
  return `${documentsPath(businessId)}/${documentId}`;
}

export function paymentsPath(businessId: string) {
  return businessScopedPath(businessId, businessCollections.payments);
}

export function paymentDocPath(businessId: string, paymentId: string) {
  return `${paymentsPath(businessId)}/${paymentId}`;
}

export function clientsPath(businessId: string) {
  return businessScopedPath(businessId, businessCollections.clients);
}

export function clientDocPath(businessId: string, clientId: string) {
  return `${clientsPath(businessId)}/${clientId}`;
}

export function businessDocsPath(businessId: string) {
  return businessScopedPath(businessId, businessCollections.businessDocs);
}

export function businessDocumentDocPath(businessId: string, docId: string) {
  return `${businessDocsPath(businessId)}/${docId}`;
}

export function termsTemplatesPath(businessId: string) {
  return businessScopedPath(businessId, businessCollections.termsTemplates);
}

export function serviceItemsPath(businessId: string) {
  return businessScopedPath(businessId, businessCollections.serviceItems);
}

export function taskTemplatesPath(businessId: string) {
  return businessScopedPath(businessId, businessCollections.taskTemplates);
}

export function paymentAllocationsPath(businessId: string) {
  return businessScopedPath(businessId, businessCollections.paymentAllocations);
}

export function taskStatusesPath(businessId: string) {
  return businessScopedPath(businessId, businessCollections.taskStatuses);
}

export function taskStatusDocPath(businessId: string, statusId: string) {
  return `${taskStatusesPath(businessId)}/${statusId}`;
}

export function movementsPath(businessId: string) {
  return businessScopedPath(businessId, businessCollections.movements);
}

export function movementDocPath(businessId: string, movementId: string) {
  return `${movementsPath(businessId)}/${movementId}`;
}
