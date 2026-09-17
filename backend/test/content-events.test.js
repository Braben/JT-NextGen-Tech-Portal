const { test,before,after } = require('node:test');
const assert = require('node:assert/strict');
const { app,db,waitForDb,cleanupTestDb } = require('./helpers');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const tokens = {};
before(async()=>{
  await waitForDb();
  for (const [id,role] of [['publisher','admin'],['writer','instructor'],['other-writer','instructor'],['reader','student']]) {
    await db.prepare('INSERT INTO users (id,name,email,password,role) VALUES (?,?,?,?,?)').run(id,id,`${id}@test.com`,'unused',role);
    tokens[id] = jwt.sign({id,role,name:id},process.env.JWT_SECRET,{expiresIn:'1h'});
  }
  await db.prepare('INSERT INTO programs (id,title,slug,description) VALUES (?,?,?,?)').run('course','Course','course','Test');
});
after(()=>cleanupTestDb());
function call(method,path,actor='publisher') { return request(app)[method](`/api${path}`).set('Authorization',`Bearer ${tokens[actor]}`); }
test('global events create without a program and update program association',async()=>{
  const created = await call('post','/events').send({title:'Open day',event_date:'2099-04-20',program_id:'none',is_public:true});
  assert.equal(created.status,200,JSON.stringify(created.body)); assert.equal(created.body.program_id,null);
  const id = created.body.id;
  assert.ok((await request(app).get('/api/events/public')).body.some(e=>e.id===id));
  const moved = await call('put',`/events/${id}`).send({program_id:'course',is_public:false});
  assert.equal(moved.status,200); assert.equal(moved.body.program_id,'course');
  assert.ok(!(await request(app).get('/api/events/public')).body.some(e=>e.id===id));
  const cleared = await call('put',`/events/${id}`).send({program_id:'',start_time:'09:00',end_time:'10:00'});
  assert.equal(cleared.body.program_id,null); assert.equal(cleared.body.start_time,'09:00');
  assert.equal((await call('delete',`/events/${id}`,'reader')).status,403);
});
test('events reject invalid dates, programs, times and unauthorized creation',async()=>{
  for (const payload of [{event_date:'2099-02-30'},{program_id:'missing'},{start_time:'14:00',end_time:'12:00'},{title:'   '},{is_public:'false'}]) {
    const result = await call('post','/events').send({title:'Event',event_date:'2099-01-20',...payload});
    assert.equal(result.status,400,JSON.stringify(result.body));
  }
  assert.equal((await call('post','/events','reader').send({title:'Event',event_date:'2099-01-20'})).status,403);
  assert.equal((await call('post','/events','writer').send({title:'Event',event_date:'2099-01-20',program_id:'course'})).status,403);
});
test('admin blog draft, publishing, sanitizing, unpublishing and deletion reach public API',async()=>{
  const created = await call('post','/blogs/manage').send({title:'Launch',content:'<h2>Section</h2><p>Body</p><script>alert(1)</script>',review_status:'draft',content_type:'blog'});
  assert.equal(created.status,201,JSON.stringify(created.body));
  const {id,slug} = created.body; assert.ok(!created.body.content.includes('script'));
  assert.equal((await request(app).get(`/api/blogs/${slug}`)).status,404);
  await request(app).get('/api/blogs'); // Prime list cache before publication.
  assert.equal((await call('put',`/blogs/manage/${id}`).send({review_status:'published'})).status,200);
  assert.ok((await request(app).get('/api/blogs')).body.some(p=>p.id===id));
  assert.equal((await request(app).get(`/api/blogs/${slug}`)).status,200);
  await call('put',`/blogs/manage/${id}`).send({review_status:'draft'});
  assert.equal((await request(app).get(`/api/blogs/${slug}`)).status,404);
  assert.ok(!(await request(app).get('/api/blogs')).body.some(p=>p.id===id));
  assert.equal((await call('delete',`/blogs/manage/${id}`)).status,200);
});
test('instructor articles require admin approval, enforce ownership and re-review edits',async()=>{
  const post = {title:'Learning guide',content:'<p>A practical guide</p>',content_type:'article',review_status:'pending'};
  const created = await call('post','/blogs/manage','writer').send(post);
  assert.equal(created.status,201,JSON.stringify(created.body));
  const {id,slug} = created.body;
  assert.equal((await call('put',`/blogs/manage/${id}`,'other-writer').send({title:'Takeover'})).status,403);
  assert.equal((await call('delete',`/blogs/manage/${id}`,'other-writer')).status,403);
  assert.equal((await call('put',`/blogs/manage/${id}`,'writer').send({review_status:'published'})).status,403);
  assert.equal((await call('get','/blogs/manage','reader')).status,403);
  assert.equal((await call('get','/blogs/manage','other-writer')).body.length,0);
  assert.equal((await request(app).get(`/api/blogs/${slug}`)).status,404);
  assert.equal((await call('put',`/blogs/manage/${id}`).send({review_status:'published'})).status,200);
  assert.ok((await request(app).get('/api/blogs?type=article')).body.some(p=>p.id===id));
  assert.ok(!(await request(app).get('/api/blogs')).body.some(p=>p.id===id));
  const revised = await call('put',`/blogs/manage/${id}`,'writer').send({content:'New revision',review_status:'pending'});
  assert.equal(revised.body.published,0); assert.equal(revised.body.review_status,'pending');
  assert.equal((await request(app).get(`/api/blogs/${slug}`)).status,404);
  assert.equal((await call('post','/blogs/manage','writer').send({...post,content_type:'blog'})).status,403);
});
test('social links are admin-managed, public-readable, validated and removable',async()=>{
  assert.equal((await call('put','/social-links','writer').send({facebook:'https://facebook.com/test'})).status,403);
  assert.equal((await call('put','/social-links').send({facebook:'javascript:alert(1)'})).status,400);
  const saved = await call('put','/social-links').send({facebook:'https://facebook.com/test',linkedin:'https://linkedin.com/company/test'});
  assert.equal(saved.status,200,JSON.stringify(saved.body));
  assert.equal((await request(app).get('/api/social-links')).body.facebook,'https://facebook.com/test');
  await call('put','/social-links').send({facebook:''});
  assert.equal((await request(app).get('/api/social-links')).body.facebook,'');
});
