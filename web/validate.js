function validState(d){
 const str=(s,n=32000)=>typeof s==='string'&&s.length<=n;
 const uid=s=>typeof s==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(s);
 const records=a=>Array.isArray(a)&&a.length<=1500&&a.every(x=>x&&uid(x.id))&&new Set(a.map(x=>x.id)).size===a.length;
 return !!d&&records(d.lessons)&&records(d.notes)&&d.lessons.every(x=>Number.isInteger(x.g)&&x.g>=0&&x.g<10&&str(x.title,500)&&str(x.body)&&str(x.task)&&[0,1,2].includes(x.priority)&&typeof x.done==='boolean'&&typeof x.date==='string'&&/^(?:\d{4}-\d\d-\d\d)?$/.test(x.date))&&d.notes.every(x=>str(x.title,500)&&str(x.body)&&str(x.context,500)&&['ملاحظة','خطأ'].includes(x.type))&&(!d.training||(typeof d.training==='object'&&[15,30,60].includes(d.training.minutes)&&typeof d.training.lab==='boolean'&&typeof d.training.mastered==='boolean'));
}
