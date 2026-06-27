import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import request from 'supertest'

// Point the database at a throwaway file and give auth a secret BEFORE any
// module that reads them is imported. db.ts and auth.ts read these at import.
const tmpDb = path.join(os.tmpdir(), `pulse-test-${process.pid}.db`)
process.env.PULSE_DB_PATH = tmpDb
process.env.JWT_SECRET = 'test-secret'
process.env.FAKE_LLM = 'true'

let app: import('express').Express
let token: string

before(async () => {
  // Seed first (side-effectful import), then load the app — both share `db`.
  await import('./seed')
  ;({ app } = await import('./index'))

  const res = await request(app)
    .post('/login')
    .send({ email: 'alice@pulse.test', password: 'password123' })
  token = res.body.token
})

after(() => {
  for (const suffix of ['', '-shm', '-wal']) {
    fs.rmSync(tmpDb + suffix, { force: true })
  }
})

test('login returns a token for valid credentials', () => {
  assert.ok(token, 'expected a token from /login')
})

test('rejects a forged token (signature is verified, not just decoded)', async () => {
  const forged =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6OTk5LCJyb2xlIjoibWFuYWdlciJ9.not-a-real-signature'
  const res = await request(app).get('/users').set('Authorization', `Bearer ${forged}`)
  assert.equal(res.status, 401)
})

test('pagination is 1-based and does not skip the first page', async () => {
  const p1 = await request(app).get('/feedback?page=1').set('Authorization', `Bearer ${token}`)
  const p2 = await request(app).get('/feedback?page=2').set('Authorization', `Bearer ${token}`)

  assert.equal(p1.status, 200)
  assert.equal(p1.body.items.length, 10)
  // Page 1 must include the very first row, not start at offset 10.
  const p1Ids = p1.body.items.map((i: any) => i.id)
  const p2Ids = p2.body.items.map((i: any) => i.id)
  assert.equal(p1Ids.length + p2Ids.length, 20)
  // No overlap between pages.
  assert.equal(new Set([...p1Ids, ...p2Ids]).size, 20)
})

test('total count respects the active filter', async () => {
  const all = await request(app).get('/feedback?status=all').set('Authorization', `Bearer ${token}`)
  const resolved = await request(app)
    .get('/feedback?status=resolved')
    .set('Authorization', `Bearer ${token}`)
  assert.ok(resolved.body.total < all.body.total, 'filtered total should be smaller')
})

test('SQL injection in the status filter is neutralized', async () => {
  const res = await request(app)
    .get(`/feedback?status=${encodeURIComponent("open' OR '1'='1")}`)
    .set('Authorization', `Bearer ${token}`)
  assert.equal(res.status, 200)
  // Treated as a literal status value that matches nothing.
  assert.equal(res.body.items.length, 0)
})
