

# הוספת שיוך לקוח ישירות מרשימת המשימות (דסקטופ)

## הבעיה
ה-TaskBacklogPanel בתצוגת הדסקטופ (שורה 1275) לא מעביר את ה-props הנדרשים לשיוך לקוח/קמפיינר, בעוד שבתצוגת המובייל (שורה 1189) הם כבר מועברים ועובדים.

## הפתרון
שינוי אחד בקובץ `src/components/tasks/WeeklyTaskBoard.tsx` — הוספת 4 props חסרים ל-`TaskBacklogPanel` בגרסת הדסקטופ (שורה ~1286):

```tsx
clientsList={clientsList}
campaignersList={campaignersList}
onUpdateClient={(taskId, clientId) => updateTaskClient.mutate({ taskId, clientId })}
onUpdateCampaigner={(taskId, campaignerId) => updateTaskCampaigner.mutate({ taskId, campaignerId })}
```

זה יאפשר את ה-Select dropdown של לקוח וקמפיינר ישירות על כרטיס המשימה ברשימה, כפי שכבר עובד במובייל.

