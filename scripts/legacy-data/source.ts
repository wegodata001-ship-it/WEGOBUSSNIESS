export type LegacyProjectRow = {
  Project_ID: string;
  Name: string;
  Location: string | null;
  Status: string;
  Start_Date: string;
  Project_Number: string | null;
  Category: string;
};

export type LegacySettingRow = {
  Set_ID: string;
  Type: "TASK_STATUS" | "TASK_PRIORITY" | "PROJ_CATEGORY";
  Value: string;
  Color: string;
};

export type LegacyCommentRow = {
  Cmt_ID: string;
  Task_ID: string;
  User_Email: string;
  Timestamp: string;
  Message: string | null;
  missingBody?: boolean;
};

export type LegacyTaskRow = {
  Task_ID: string;
  Project_ID: string;
  Task_Name: string;
  Task_Category?: string | null;
  Assigned_To?: string | null;
  Priority?: string | null;
  Status?: string | null;
  Date_Created?: string | null;
  Date_Start?: string | null;
  Date_Due?: string | null;
  Date_Completed?: string | null;
  Planned_Hours?: string | number | null;
  Is_Sent?: string | boolean | null;
  Creator_Email?: string | null;
  Approval_Status?: string | null;
  Last_Update?: string | null;
  Task_Description?: string | null;
  Recurrence?: string | null;
};

export const LEGACY_PROJECTS: LegacyProjectRow[] = [
  { Project_ID: "PRJ-1789454997938", Name: "משקאת קפה", Location: "עין מאהל", Status: "Active", Start_Date: "2026-09-15 09:49:58", Project_Number: "315799668", Category: "ייעוץ וליווי עסקי" },
  { Project_ID: "PRJ-1789456852263", Name: "משמיות כלליות חליל", Location: null, Status: "Active", Start_Date: "2026-09-15 10:20:52", Project_Number: null, Category: "ייעוץ וליווי עסקי" },
  { Project_ID: "PRJ-1789460554919", Name: "zella pelates", Location: null, Status: "Active", Start_Date: "2026-09-15 11:22:35", Project_Number: null, Category: "פרסום ושיווק" },
  { Project_ID: "PRJ-1789460811313", Name: "HAGOR -", Location: "עין מאהל", Status: "Active", Start_Date: "2026-09-15 11:26:51", Project_Number: null, Category: "ייעוץ וליווי עסקי" },
  { Project_ID: "PRJ-1789461268322", Name: "מסעדת - סושי עארף", Location: null, Status: "Active", Start_Date: "2026-09-15 11:34:28", Project_Number: null, Category: "פרסום ושיווק" },
  { Project_ID: "PRJ-1789462147473", Name: "משימות כלליות - תסניים מהנדס מחשבים", Location: null, Status: "Active", Start_Date: "2026-09-15 11:49:07", Project_Number: null, Category: "הנהלת חשבונות וראיית חשבון" },
  { Project_ID: "PRJ-1789462453525", Name: "משימות כלליות שיראז", Location: null, Status: "Active", Start_Date: "2026-09-15 11:54:14", Project_Number: null, Category: "פרסום ושיווק" },
  { Project_ID: "PRJ-1789468992739", Name: "סעיד דחלה מסעדת קריספי", Location: "טורעאן", Status: "Active", Start_Date: "2026-09-15 13:43:13", Project_Number: null, Category: "מערכות ואתרים" },
  { Project_ID: "PRJ-1789470446570", Name: "אריסטו", Location: "ערערה", Status: "Active", Start_Date: "2026-09-15 14:07:27", Project_Number: null, Category: "מערכות ואתרים" },
  { Project_ID: "PRJ-1789558934596", Name: "حلويات القدس", Location: null, Status: "Active", Start_Date: "2026-09-16 14:42:15", Project_Number: null, Category: "מערכות ואתרים" },
  { Project_ID: "PRJ-1789559307440", Name: "משקאה", Location: null, Status: "Active", Start_Date: "2026-09-16 14:48:27", Project_Number: null, Category: "מערכות ואתרים" },
  { Project_ID: "PRJ-1789559477738", Name: "קירור נאדר", Location: null, Status: "Active", Start_Date: "2026-09-16 14:51:18", Project_Number: null, Category: "מערכות ואתרים" },
  { Project_ID: "PRJ-1789560486746", Name: "ג.א חשמל", Location: null, Status: "Active", Start_Date: "2026-09-16 15:08:07", Project_Number: null, Category: "מערכות ואתרים" },
  { Project_ID: "PRJ-1789560780262", Name: "אטלס", Location: null, Status: "Active", Start_Date: "2026-09-16 15:13:00", Project_Number: null, Category: "מערכות ואתרים" },
  { Project_ID: "PRJ-1789561346475", Name: "OPAL", Location: null, Status: "Active", Start_Date: "2026-09-16 15:22:26", Project_Number: null, Category: "מערכות ואתרים" },
  { Project_ID: "PRJ-1789562219722", Name: "wego-p", Location: null, Status: "Active", Start_Date: "2026-09-16 15:37:00", Project_Number: null, Category: "מערכות ואתרים" },
  { Project_ID: "PRJ-1789562591667", Name: "عزايز", Location: null, Status: "Active", Start_Date: "2026-09-16 15:43:12", Project_Number: null, Category: "מערכות ואתרים" },
  { Project_ID: "PRJ-1789563173451", Name: "נקודת חן", Location: null, Status: "Active", Start_Date: "2026-09-16 15:52:53", Project_Number: null, Category: "הנהלת חשבונות וראיית חשבון" },
  { Project_ID: "PRJ-1789563410342", Name: "שירין", Location: null, Status: "Active", Start_Date: "2026-09-16 15:56:50", Project_Number: null, Category: "מערכות ואתרים" },
];

export const LEGACY_SETTINGS: LegacySettingRow[] = [
  { Set_ID: "SET-0.17088955623370938", Type: "TASK_STATUS", Value: "לביצוע", Color: "#64748b" },
  { Set_ID: "SET-0.753460227331085", Type: "TASK_STATUS", Value: "בביצוע", Color: "#3b82f6" },
  { Set_ID: "SET-0.08110317652991683", Type: "TASK_STATUS", Value: "ממתין", Color: "#f59e0b" },
  { Set_ID: "SET-0.8192852038505092", Type: "TASK_STATUS", Value: "הושלם", Color: "#10b981" },
  { Set_ID: "SET-0.5607238228056154", Type: "TASK_STATUS", Value: "בוטל", Color: "#ef4444" },
  { Set_ID: "SET-0.1860327812812257", Type: "TASK_STATUS", Value: "ארכיון", Color: "#94a3b8" },
  { Set_ID: "SET-0.15845353022249142", Type: "TASK_PRIORITY", Value: "רגיל", Color: "#3b82f6" },
  { Set_ID: "SET-0.2696190088981628", Type: "TASK_PRIORITY", Value: "בינוני", Color: "#f59e0b" },
  { Set_ID: "SET-0.6614780993255026", Type: "TASK_PRIORITY", Value: "דחוף", Color: "#ef4444" },
  { Set_ID: "SET-0.5356037604537975", Type: "PROJ_CATEGORY", Value: "הנהלת חשבונות וראיית חשבון", Color: "#8b5cf6" },
  { Set_ID: "SET-0.32798103202397655", Type: "PROJ_CATEGORY", Value: "פרסום ושיווק", Color: "#ec4899" },
  { Set_ID: "SET-0.8026634176501657", Type: "PROJ_CATEGORY", Value: "ייעוץ וליווי עסקי", Color: "#14b8a6" },
  { Set_ID: "SET-0.5445095493019138", Type: "PROJ_CATEGORY", Value: "גיוס כספים", Color: "#f59e0b" },
  { Set_ID: "SET-1789461834168", Type: "PROJ_CATEGORY", Value: "מערכות ואתרים", Color: "#f7b75f" },
  { Set_ID: "SET-1789469543523", Type: "PROJ_CATEGORY", Value: "עורכי סרטונים", Color: "#723131" },
];

export const LEGACY_COMMENTS: LegacyCommentRow[] = [
  { Cmt_ID: "CMT-1789460572915", Task_ID: "TSK-1789460555051", User_Email: "admin@wego.co.il", Timestamp: "2026-09-15 11:22:53", Message: null, missingBody: true },
  { Cmt_ID: "CMT-1789468526194", Task_ID: "TSK-1789462453683", User_Email: "shiraz@wego.com", Timestamp: "2026-09-15 13:35:26", Message: "הלקוח מבקש הצעת מחיר עבור מסעדה שהולך לפתוח" },
  { Cmt_ID: "CMT-1789469404058", Task_ID: "TSK-1789461268443", User_Email: "shiraz@wego", Timestamp: "2026-09-15 13:50:04", Message: null, missingBody: true },
  { Cmt_ID: "CMT-1789470043386", Task_ID: "TSK-1789469934591", User_Email: "shiraz@wego", Timestamp: "2026-09-15 14:00:43", Message: "הסרטון הזה נשלח מיום ראשון ועדיין לא טופל !" },
  { Cmt_ID: "CMT-1789477946556", Task_ID: "TSK-1789454998117", User_Email: "admin@wego.co.il", Timestamp: "2026-09-15 16:12:27", Message: "תרגום אוטמטי  כפתור נגישות  סרטונים בחוויות דעת  ארכיון חשבונית עם הורדת כל חשבוניות  או שליחה לאימיל של ראה חשבון קטגוריות חשבונית לא מסודרת - לסדר מלל" },
  { Cmt_ID: "CMT-1789557648940", Task_ID: "TSK-1789460811470", User_Email: "tasnem@wego", Timestamp: "2026-09-16 14:20:49", Message: "טופל בשינויים ל HAGOUR - נשלח ללקוח +לקוח במעקב" },
];

export const REPAIRED_PROJECT_IDS: Record<string, string> = {
  NEW: "PRJ-1789559477738",
};
