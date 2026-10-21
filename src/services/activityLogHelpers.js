export function getFirst(object, keys) {
  for (const key of keys) {
    if (object?.[key] !== undefined && object?.[key] !== null) {
      return object[key];
    }
  }
  return undefined;
}

export function getActivityList(response) {
  if (Array.isArray(response)) return response;

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  const candidates = [
    response?.activities,
    response?.content,
    response?.items,
    response?.results,
    response?.logs,
    response?.data?.activities,
    response?.data?.items,
    response?.data?.content,
    response?.data?.results,
  ];

  return candidates.find(Array.isArray) ?? [];
}

export function getAccount(activity) {
  return (
    activity?.customerName ||
    activity?.username ||
    activity?.userName ||
    activity?.adminName ||
    activity?.email ||
    activity?.account ||
    "Không xác định"
  );
}

export function getAction(activity) {
  return (
    activity?.title ||
    activity?.detail ||
    activity?.action ||
    activity?.type ||
    "Không xác định"
  );
}

export function getTimestamp(activity) {
  return getFirst(activity, [
    "timestamp",
    "createdAt",
    "created_at",
    "occurredAt",
    "time",
    "date",
    "performedAt",
  ]);
}

export function formatDate(value) {
  if (!value) return "Không có dữ liệu";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
}

export function formatValue(value) {
  if (value === undefined || value === null || value === "") {
    return "Không có dữ liệu";
  }

  if (typeof value === "string") {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }

  return JSON.stringify(value, null, 2) ?? String(value);
}

export function getBefore(activity) {
  return getFirst(activity, [
    "before",
    "beforeData",
    "oldValue",
    "oldData",
    "previousValue",
    "previousData",
    "oldValues",
  ]);
}

export function getAfter(activity) {
  return getFirst(activity, [
    "after",
    "afterData",
    "newValue",
    "newData",
    "currentValue",
    "newValues",
  ]);
}

export function getIp(activity) {
  return (
    activity?.ipAddress ||
    activity?.ip_address ||
    activity?.ip ||
    activity?.clientIp ||
    "Chưa được cung cấp"
  );
}

export function getActivityId(activity, index) {
  return (
    getFirst(activity, ["id", "_id", "activityId", "logId"]) ??
    `${getTimestamp(activity) ?? "activity"}-${index}`
  );
}
