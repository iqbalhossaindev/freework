/* ═══════════════════════════════════════════════════════
   FREEWORK — CORE DATA LAYER (localStorage simulation)
   In production: replace with real API calls
   ═══════════════════════════════════════════════════════ */
'use strict';

const FW = {

  /* ── Simple hash (demo — use bcrypt in production) ── */
  hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0; }
    return 'h_' + Math.abs(h).toString(36) + str.length;
  },

  /* ── ID generator ── */
  uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); },

  /* ── DB helpers ── */
  db: {
    get(key) { try { return JSON.parse(localStorage.getItem('fw_' + key) || 'null'); } catch { return null; } },
    set(key, val) { localStorage.setItem('fw_' + key, JSON.stringify(val)); },
    getList(key) { return this.get(key) || []; },
    setList(key, arr) { this.set(key, arr); },
    push(key, item) { const a = this.getList(key); a.push(item); this.setList(key, a); return item; },
    update(key, id, changes) {
      const a = this.getList(key);
      const i = a.findIndex(x => x.id === id);
      if (i !== -1) { a[i] = { ...a[i], ...changes, updatedAt: new Date().toISOString() }; this.setList(key, a); return a[i]; }
      return null;
    },
    find(key, id) { return this.getList(key).find(x => x.id === id) || null; },
    where(key, fn) { return this.getList(key).filter(fn); }
  },

  /* ── Settings ── */
  settings: {
    get() {
      return FW.db.get('settings') || {
        registrationFee: '5.00',
        coin: 'USDC', network: 'Solana',
        walletAddress: 'ALA8ep2VYdkbWNCvwZxgQoYD5FMVDkRwYVB4Q9ML1YUG',
        maxTasksPerUser: 10, taskResetHours: 24,
        minWithdrawal: '5.00', withdrawHoldHours: 72,
        platformName: 'FreeWork', supportEmail: 'support@freework.io'
      };
    },
    save(data) { FW.db.set('settings', data); }
  },

  /* ── Auth ── */
  auth: {
    login(identifier, password) {
      const users = FW.db.getList('users');
      const user = users.find(u =>
        (u.email === identifier || u.phone === identifier || u.username === identifier) &&
        u.passwordHash === FW.hash(password)
      );
      if (!user) return { ok: false, msg: 'Invalid credentials.' };
      if (user.status === 'pending') return { ok: false, msg: 'Your registration is under review.' };
      if (user.status === 'rejected') return { ok: false, msg: 'Your registration was rejected. Please contact support.' };
      if (user.status === 'suspended') return { ok: false, msg: 'Your account is suspended. Please contact support.' };
      if (user.status !== 'approved') return { ok: false, msg: 'Account not active.' };
      const token = FW.uid();
      sessionStorage.setItem('fw_session', JSON.stringify({ userId: user.id, token, role: 'worker', at: Date.now() }));
      FW.db.update('users', user.id, { lastLoginAt: new Date().toISOString() });
      return { ok: true, user };
    },
    logout() { sessionStorage.removeItem('fw_session'); window.location.href = 'login.html'; },
    session() { try { return JSON.parse(sessionStorage.getItem('fw_session')); } catch { return null; } },
    me() {
      const s = this.session();
      if (!s) return null;
      return FW.db.find('users', s.userId);
    },
    require() {
      const s = this.session();
      if (!s || s.role !== 'worker') { window.location.href = 'login.html'; return null; }
      const u = FW.db.find('users', s.userId);
      if (!u || u.status !== 'approved') { sessionStorage.clear(); window.location.href = 'login.html'; return null; }
      return u;
    },
    adminLogin(pass) {
      const stored = FW.db.get('adminPass') || FW.hash('Admin@FW2025!');
      if (FW.hash(pass) !== stored) return false;
      sessionStorage.setItem('fw_admin', JSON.stringify({ role: 'admin', at: Date.now() }));
      return true;
    },
    adminSession() { try { const s = JSON.parse(sessionStorage.getItem('fw_admin')); return s?.role === 'admin' ? s : null; } catch { return null; } },
    adminLogout() { sessionStorage.removeItem('fw_admin'); window.location.href = 'login.html'; },
    requireAdmin() { if (!this.adminSession()) { window.location.href = 'login.html'; return false; } return true; }
  },

  /* ── Users ── */
  users: {
    register(data) {
      const existing = FW.db.getList('users');
      if (existing.find(u => u.email === data.email)) return { ok: false, msg: 'Email already registered.' };
      if (existing.find(u => u.phone === data.phone)) return { ok: false, msg: 'Phone already registered.' };
      if (existing.find(u => u.username === data.username)) return { ok: false, msg: 'Username already taken.' };
      const user = {
        id: FW.uid(), username: data.username, fullName: data.fullName,
        phone: data.phone, email: data.email, country: data.country,
        passwordHash: FW.hash(data.password),
        tier: 'demo', status: 'pending',
        balance: 0, totalEarned: 0, totalDeposited: 0, totalWithdrawn: 0,
        pendingWithdrawal: 0,
        registrationTxid: data.txid, registrationScreenshot: data.screenshot,
        tasksTotal: 0, tasksCompleted: 0, tasksPending: 0, tasksApproved: 0, tasksRejected: 0,
        taskSlots: [], maxTasks: 10,
        lastTaskCompletedAt: null, taskResetEligibleAt: null, taskResetStatus: 'available',
        withdrawalEligible: false, lastWithdrawalAt: null,
        createdAt: new Date().toISOString()
      };
      FW.db.push('users', user);
      FW.audit.log('registration_submitted', 'system', user.id, { username: user.username });
      return { ok: true, user };
    },
    all() { return FW.db.getList('users'); },
    find(id) { return FW.db.find('users', id); },
    update(id, data) { return FW.db.update('users', id, data); },
    approve(id) {
      const u = FW.db.update('users', id, { status: 'approved', approvedAt: new Date().toISOString() });
      FW.notifications.send(id, 'Registration Approved', 'Welcome to FreeWork! Your account is now active. Start exploring available tasks.', 'account');
      FW.audit.log('registration_approved', 'admin', id, {});
      return u;
    },
    reject(id, reason) {
      const u = FW.db.update('users', id, { status: 'rejected', rejectedAt: new Date().toISOString(), rejectionReason: reason || '' });
      FW.notifications.send(id, 'Registration Rejected', reason || 'Your registration was rejected. Please contact support.', 'account');
      FW.audit.log('registration_rejected', 'admin', id, { reason });
      return u;
    },
    suspend(id) {
      const u = FW.db.update('users', id, { status: 'suspended' });
      FW.audit.log('user_suspended', 'admin', id, {});
      return u;
    },
    activate(id) {
      const u = FW.db.update('users', id, { status: 'approved' });
      FW.audit.log('user_activated', 'admin', id, {});
      return u;
    },
    changeTier(id, tier) {
      const u = FW.db.update('users', id, { tier });
      FW.notifications.send(id, 'Account Tier Updated', `Your account tier has been upgraded to ${tier.charAt(0).toUpperCase() + tier.slice(1)}. New tasks are now available!`, 'account');
      FW.audit.log('tier_changed', 'admin', id, { tier });
      return u;
    },
    addBalance(id, amount, note) {
      const u = FW.db.find('users', id);
      if (!u) return null;
      const newBal = +(u.balance + amount).toFixed(2);
      const updated = FW.db.update('users', id, { balance: newBal });
      FW.audit.log('balance_added', 'admin', id, { amount, note, newBalance: newBal });
      FW.notifications.send(id, 'Balance Updated', `$${amount.toFixed(2)} has been added to your account. New balance: $${newBal.toFixed(2)}`, 'balance');
      return updated;
    },
    removeBalance(id, amount, note) {
      const u = FW.db.find('users', id);
      if (!u) return null;
      const newBal = Math.max(0, +(u.balance - amount).toFixed(2));
      const updated = FW.db.update('users', id, { balance: newBal });
      FW.audit.log('balance_removed', 'admin', id, { amount, note, newBalance: newBal });
      return updated;
    },
    checkWithdrawEligibility(id) {
      const u = FW.db.find('users', id);
      if (!u) return { eligible: false, reason: 'User not found' };
      if (u.status !== 'approved') return { eligible: false, reason: 'Account not active' };
      // Need 10/10 approved tasks
      const s = FW.settings.get();
      const maxTasks = s.maxTasksPerUser;
      if (u.tasksApproved < maxTasks) return { eligible: false, reason: `Pending task. Please complete your tasks first, then request withdrawal.` };
      if (u.balance <= 0) return { eligible: false, reason: 'No available balance' };
      if (u.balance < parseFloat(s.minWithdrawal)) return { eligible: false, reason: `Minimum withdrawal is $${s.minWithdrawal}` };
      return { eligible: true, reason: 'Eligible' };
    },
    resetTasks(id, override) {
      const u = FW.db.find('users', id);
      if (!u) return { ok: false, msg: 'User not found' };
      if (!override && u.lastTaskCompletedAt) {
        const s = FW.settings.get();
        const hrs = (Date.now() - new Date(u.lastTaskCompletedAt).getTime()) / 3600000;
        if (hrs < s.taskResetHours) return { ok: false, msg: `Task reset not available yet. ${(s.taskResetHours - hrs).toFixed(1)}h remaining.` };
      }
      FW.db.update('users', id, {
        tasksCompleted: 0, tasksPending: 0, tasksApproved: 0, tasksRejected: 0,
        taskSlots: [], withdrawalEligible: false,
        taskResetStatus: 'available', taskResetEligibleAt: null
      });
      FW.notifications.send(id, 'Tasks Reset', 'Your tasks have been reset. New tasks are now available!', 'task');
      FW.audit.log('task_reset', 'admin', id, { override: !!override });
      return { ok: true };
    }
  },

  /* ── Tasks ── */
  tasks: {
    create(data) {
      const task = {
        id: FW.uid(), photo: data.photo || '', title: data.title,
        description: data.description, link: data.link || '',
        reward: parseFloat(data.reward) || 0,
        tier: data.tier || 'all', type: data.type || 'normal',
        assignedUser: data.assignedUser || null,
        campaignId: data.campaignId || null,
        status: 'active', createdAt: new Date().toISOString(),
        completions: 0, maxCompletions: parseInt(data.maxCompletions) || 0
      };
      FW.db.push('tasks', task);
      FW.audit.log('task_created', 'admin', null, { taskId: task.id, title: task.title });
      return task;
    },
    all() { return FW.db.getList('tasks'); },
    find(id) { return FW.db.find('tasks', id); },
    update(id, data) { return FW.db.update('tasks', id, data); },
    forUser(user) {
      const all = FW.db.getList('tasks').filter(t => t.status === 'active');
      return all.filter(t => {
        if (t.type === 'specific' || t.type === 'shared') return t.assignedUser === user.id;
        if (t.type === 'special') return t.assignedUser === user.id;
        if (t.type === 'new-user') {
          const ageDays = (Date.now() - new Date(user.createdAt).getTime()) / 86400000;
          return ageDays <= 7;
        }
        // tier check
        if (t.tier !== 'all' && t.tier !== user.tier) return false;
        return true;
      });
    }
  },

  /* ── Task Submissions ── */
  submissions: {
    submit(userId, taskId, data) {
      const user = FW.db.find('users', userId);
      const task = FW.db.find('tasks', taskId);
      if (!user || !task) return { ok: false, msg: 'Invalid submission' };
      // check duplicate
      const existing = FW.db.getList('submissions').find(s => s.userId === userId && s.taskId === taskId && s.status !== 'rejected');
      if (existing) return { ok: false, msg: 'You already submitted this task.' };
      const sub = {
        id: FW.uid(), userId, taskId, taskTitle: task.title,
        note: data.note || '', screenshot: data.screenshot || '',
        link: data.link || '', reward: task.reward,
        status: 'pending', submittedAt: new Date().toISOString(), reviewedAt: null
      };
      FW.db.push('submissions', sub);
      // update user task counts
      FW.db.update('users', userId, {
        tasksPending: (user.tasksPending || 0) + 1,
        tasksTotal: (user.tasksTotal || 0) + 1
      });
      FW.audit.log('task_submitted', userId, userId, { taskId, title: task.title });
      return { ok: true, sub };
    },
    approve(subId) {
      const sub = FW.db.find('submissions', subId);
      if (!sub) return { ok: false };
      const user = FW.db.find('users', sub.userId);
      if (!user) return { ok: false };
      FW.db.update('submissions', subId, { status: 'approved', reviewedAt: new Date().toISOString() });
      const newApproved = (user.tasksApproved || 0) + 1;
      const newCompleted = (user.tasksCompleted || 0) + 1;
      const newPending = Math.max(0, (user.tasksPending || 0) - 1);
      const newBal = +(user.balance + sub.reward).toFixed(2);
      const newEarned = +(user.totalEarned + sub.reward).toFixed(2);
      const s = FW.settings.get();
      const eligible = newApproved >= s.maxTasksPerUser;
      FW.db.update('users', sub.userId, {
        balance: newBal, totalEarned: newEarned,
        tasksApproved: newApproved, tasksCompleted: newCompleted,
        tasksPending: newPending, withdrawalEligible: eligible,
        lastTaskCompletedAt: new Date().toISOString()
      });
      FW.notifications.send(sub.userId, 'Task Approved!', `Your task "${sub.taskTitle}" was approved. $${sub.reward.toFixed(2)} added to your balance.`, 'task');
      if (eligible) FW.notifications.send(sub.userId, '🎉 Withdrawal Unlocked!', 'You have completed all 10 tasks! You can now request a withdrawal.', 'withdrawal');
      FW.audit.log('task_approved', 'admin', sub.userId, { subId, reward: sub.reward });
      return { ok: true };
    },
    reject(subId, reason) {
      const sub = FW.db.find('submissions', subId);
      if (!sub) return { ok: false };
      const user = FW.db.find('users', sub.userId);
      FW.db.update('submissions', subId, { status: 'rejected', reviewedAt: new Date().toISOString(), rejectionReason: reason || '' });
      if (user) FW.db.update('users', sub.userId, { tasksPending: Math.max(0, (user.tasksPending || 0) - 1), tasksRejected: (user.tasksRejected || 0) + 1 });
      FW.notifications.send(sub.userId, 'Task Rejected', `Your task "${sub.taskTitle}" was rejected. ${reason || 'Please review and resubmit.'}`, 'task');
      FW.audit.log('task_rejected', 'admin', sub.userId, { subId, reason });
      return { ok: true };
    },
    forUser(userId) { return FW.db.getList('submissions').filter(s => s.userId === userId); },
    all() { return FW.db.getList('submissions'); }
  },

  /* ── Deposits ── */
  deposits: {
    submit(userId, data) {
      const dep = {
        id: FW.uid(), userId, amount: parseFloat(data.amount),
        method: data.method, txid: data.txid,
        screenshot: data.screenshot || '',
        status: 'pending', submittedAt: new Date().toISOString(), reviewedAt: null
      };
      FW.db.push('deposits', dep);
      FW.audit.log('deposit_submitted', userId, userId, { amount: dep.amount });
      return dep;
    },
    approve(depId) {
      const dep = FW.db.find('deposits', depId);
      if (!dep) return { ok: false };
      const user = FW.db.find('users', dep.userId);
      if (!user) return { ok: false };
      FW.db.update('deposits', depId, { status: 'approved', reviewedAt: new Date().toISOString() });
      const newBal = +(user.balance + dep.amount).toFixed(2);
      const newDep = +(user.totalDeposited + dep.amount).toFixed(2);
      FW.db.update('users', dep.userId, { balance: newBal, totalDeposited: newDep });
      FW.notifications.send(dep.userId, 'Deposit Approved', `Your deposit of $${dep.amount.toFixed(2)} has been approved and added to your balance.`, 'deposit');
      FW.audit.log('deposit_approved', 'admin', dep.userId, { depId, amount: dep.amount });
      return { ok: true };
    },
    reject(depId, reason) {
      const dep = FW.db.find('deposits', depId);
      if (!dep) return { ok: false };
      FW.db.update('deposits', depId, { status: 'rejected', reviewedAt: new Date().toISOString(), rejectionReason: reason });
      FW.notifications.send(dep.userId, 'Deposit Rejected', `Your deposit of $${dep.amount.toFixed(2)} was rejected. ${reason || ''}`, 'deposit');
      FW.audit.log('deposit_rejected', 'admin', dep.userId, { depId, reason });
      return { ok: true };
    },
    forUser(userId) { return FW.db.getList('deposits').filter(d => d.userId === userId); },
    all() { return FW.db.getList('deposits'); }
  },

  /* ── Withdrawals ── */
  withdrawals: {
    submit(userId, data) {
      const elig = FW.users.checkWithdrawEligibility(userId);
      if (!elig.eligible) return { ok: false, msg: elig.reason };
      const user = FW.db.find('users', userId);
      const amount = parseFloat(data.amount);
      const s = FW.settings.get();
      if (amount < parseFloat(s.minWithdrawal)) return { ok: false, msg: `Minimum withdrawal is $${s.minWithdrawal}` };
      if (amount > user.balance) return { ok: false, msg: 'Insufficient balance.' };
      const wd = {
        id: FW.uid(), userId, amount,
        method: data.method, accountDetails: data.accountDetails,
        userBalance: user.balance, tasksApproved: user.tasksApproved,
        tasksPending: user.tasksPending, tasksCompleted: user.tasksCompleted,
        status: 'pending', submittedAt: new Date().toISOString(), reviewedAt: null
      };
      FW.db.push('withdrawals', wd);
      // deduct from balance, add to pending
      FW.db.update('users', userId, {
        balance: +(user.balance - amount).toFixed(2),
        pendingWithdrawal: +((user.pendingWithdrawal || 0) + amount).toFixed(2),
        lastWithdrawalAt: new Date().toISOString()
      });
      FW.audit.log('withdrawal_submitted', userId, userId, { amount });
      return { ok: true, wd };
    },
    approve(wdId) {
      const wd = FW.db.find('withdrawals', wdId);
      if (!wd) return { ok: false };
      const user = FW.db.find('users', wd.userId);
      FW.db.update('withdrawals', wdId, { status: 'approved', reviewedAt: new Date().toISOString() });
      const newPending = Math.max(0, +((user.pendingWithdrawal || 0) - wd.amount).toFixed(2));
      const newWithdrawn = +((user.totalWithdrawn || 0) + wd.amount).toFixed(2);
      FW.db.update('users', wd.userId, { pendingWithdrawal: newPending, totalWithdrawn: newWithdrawn });
      FW.notifications.send(wd.userId, 'Withdrawal Approved', `Your withdrawal of $${wd.amount.toFixed(2)} has been approved and processed.`, 'withdrawal');
      FW.audit.log('withdrawal_approved', 'admin', wd.userId, { wdId, amount: wd.amount });
      return { ok: true };
    },
    reject(wdId, reason) {
      const wd = FW.db.find('withdrawals', wdId);
      if (!wd) return { ok: false };
      const user = FW.db.find('users', wd.userId);
      FW.db.update('withdrawals', wdId, { status: 'rejected', reviewedAt: new Date().toISOString(), rejectionReason: reason });
      // refund
      const newBal = +(user.balance + wd.amount).toFixed(2);
      const newPending = Math.max(0, +((user.pendingWithdrawal || 0) - wd.amount).toFixed(2));
      FW.db.update('users', wd.userId, { balance: newBal, pendingWithdrawal: newPending });
      FW.notifications.send(wd.userId, 'Withdrawal Rejected', `Your withdrawal of $${wd.amount.toFixed(2)} was rejected. Amount returned to balance. ${reason || ''}`, 'withdrawal');
      FW.audit.log('withdrawal_rejected', 'admin', wd.userId, { wdId, reason });
      return { ok: true };
    },
    forUser(userId) { return FW.db.getList('withdrawals').filter(w => w.userId === userId); },
    all() { return FW.db.getList('withdrawals'); }
  },

  /* ── Campaigns ── */
  campaigns: {
    create(data) {
      const c = {
        id: FW.uid(), title: data.title, description: data.description,
        type: data.type || 'normal', tier: data.tier || 'all',
        assignedUser: data.assignedUser || null,
        status: 'active', reward: parseFloat(data.reward) || 0,
        startDate: data.startDate || null, endDate: data.endDate || null,
        createdAt: new Date().toISOString()
      };
      FW.db.push('campaigns', c);
      FW.audit.log('campaign_created', 'admin', null, { campaignId: c.id, title: c.title });
      return c;
    },
    all() { return FW.db.getList('campaigns'); },
    find(id) { return FW.db.find('campaigns', id); },
    update(id, data) { return FW.db.update('campaigns', id, data); },
    forUser(user) {
      return FW.db.getList('campaigns').filter(c => {
        if (c.status !== 'active') return false;
        if (c.type === 'specific' || c.type === 'shared') return c.assignedUser === user.id;
        if (c.type === 'new-user') {
          const ageDays = (Date.now() - new Date(user.createdAt).getTime()) / 86400000;
          return ageDays <= 7;
        }
        if (c.tier !== 'all' && c.tier !== user.tier) return false;
        return true;
      });
    }
  },

  /* ── Special Events ── */
  events: {
    create(data) {
      const ev = {
        id: FW.uid(), photo: data.photo || '', title: data.title,
        description: data.description, link: data.link || '',
        reward: parseFloat(data.reward) || 0,
        assignedUser: data.assignedUser,
        startDate: data.startDate, endDate: data.endDate,
        status: 'active', submissionStatus: null,
        createdAt: new Date().toISOString()
      };
      FW.db.push('events', ev);
      FW.notifications.send(data.assignedUser, '🌟 Special Event Assigned!', `You have a new Special Event: "${ev.title}". Check your dashboard!`, 'special');
      FW.audit.log('special_event_created', 'admin', data.assignedUser, { eventId: ev.id, title: ev.title });
      return ev;
    },
    all() { return FW.db.getList('events'); },
    find(id) { return FW.db.find('events', id); },
    update(id, data) { return FW.db.update('events', id, data); },
    forUser(userId) { return FW.db.getList('events').filter(e => e.assignedUser === userId && e.status !== 'cancelled'); },
    approve(evId) {
      const ev = FW.db.find('events', evId);
      if (!ev) return { ok: false };
      const user = FW.db.find('users', ev.assignedUser);
      FW.db.update('events', evId, { status: 'completed', submissionStatus: 'approved', reviewedAt: new Date().toISOString() });
      if (user) {
        const newBal = +(user.balance + ev.reward).toFixed(2);
        FW.db.update('users', ev.assignedUser, { balance: newBal, totalEarned: +(user.totalEarned + ev.reward).toFixed(2) });
        FW.notifications.send(ev.assignedUser, 'Special Event Approved!', `Your special event "${ev.title}" was approved! $${ev.reward.toFixed(2)} added to your balance.`, 'special');
      }
      FW.audit.log('special_event_approved', 'admin', ev.assignedUser, { evId, reward: ev.reward });
      return { ok: true };
    },
    reject(evId, reason) {
      FW.db.update('events', evId, { submissionStatus: 'rejected', reviewedAt: new Date().toISOString(), rejectionReason: reason });
      const ev = FW.db.find('events', evId);
      if (ev) FW.notifications.send(ev.assignedUser, 'Special Event Rejected', `Your special event "${ev.title}" was rejected. ${reason || ''}`, 'special');
      FW.audit.log('special_event_rejected', 'admin', ev?.assignedUser, { evId, reason });
      return { ok: true };
    }
  },

  /* ── Notifications ── */
  notifications: {
    send(userId, title, message, type) {
      const n = {
        id: FW.uid(), userId, title, message, type: type || 'info',
        read: false, createdAt: new Date().toISOString()
      };
      FW.db.push('notifications', n);
      return n;
    },
    sendAll(title, message, type) {
      FW.db.getList('users').filter(u => u.status === 'approved').forEach(u => {
        FW.notifications.send(u.id, title, message, type);
      });
      FW.audit.log('notification_sent_all', 'admin', null, { title });
    },
    sendTier(tier, title, message, type) {
      FW.db.getList('users').filter(u => u.status === 'approved' && u.tier === tier).forEach(u => {
        FW.notifications.send(u.id, title, message, type);
      });
      FW.audit.log('notification_sent_tier', 'admin', null, { tier, title });
    },
    forUser(userId) { return FW.db.getList('notifications').filter(n => n.userId === userId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); },
    unreadCount(userId) { return FW.db.getList('notifications').filter(n => n.userId === userId && !n.read).length; },
    markRead(id) { FW.db.update('notifications', id, { read: true }); },
    markAllRead(userId) {
      const all = FW.db.getList('notifications');
      all.forEach(n => { if (n.userId === userId) n.read = true; });
      FW.db.setList('notifications', all);
    }
  },

  /* ── Audit Log ── */
  audit: {
    log(action, performedBy, targetUser, details) {
      FW.db.push('auditLog', {
        id: FW.uid(), action, performedBy, targetUser,
        details, timestamp: new Date().toISOString()
      });
    },
    all() { return FW.db.getList('auditLog').sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); }
  },

  /* ── Seed demo data ── */
  seed() {
    if (FW.db.get('seeded')) return;
    // Admin password: Admin@FW2025!
    FW.db.set('adminPass', FW.hash('Admin@FW2025!'));
    // Demo users
    const demoUser = {
      id: 'demo001', username: 'worker1', fullName: 'Iqbal Hossain',
      phone: '+971563485950', email: 'worker1@example.com', country: 'UAE',
      passwordHash: FW.hash('Worker@123'), tier: 'demo', status: 'approved',
      balance: 12.00, totalEarned: 18.50, totalDeposited: 5.00, totalWithdrawn: 0,
      pendingWithdrawal: 0,
      registrationTxid: 'DEMO_TXID_001', registrationScreenshot: '',
      tasksTotal: 7, tasksCompleted: 3, tasksPending: 2, tasksApproved: 3, tasksRejected: 2,
      taskSlots: [], maxTasks: 10,
      lastTaskCompletedAt: new Date(Date.now() - 2 * 3600000).toISOString(),
      taskResetEligibleAt: null, taskResetStatus: 'available',
      withdrawalEligible: false, lastWithdrawalAt: null,
      createdAt: new Date(Date.now() - 5 * 86400000).toISOString(), approvedAt: new Date(Date.now() - 4 * 86400000).toISOString()
    };
    const silverUser = {
      id: 'demo002', username: 'maria_k', fullName: 'Maria Khan',
      phone: '+447700900123', email: 'maria@example.com', country: 'UK',
      passwordHash: FW.hash('Worker@123'), tier: 'silver', status: 'approved',
      balance: 67.00, totalEarned: 120.00, totalDeposited: 10.00, totalWithdrawn: 50.00,
      pendingWithdrawal: 0,
      registrationTxid: 'DEMO_TXID_002', registrationScreenshot: '',
      tasksTotal: 10, tasksCompleted: 10, tasksPending: 0, tasksApproved: 10, tasksRejected: 0,
      taskSlots: [], maxTasks: 10,
      lastTaskCompletedAt: new Date(Date.now() - 25 * 3600000).toISOString(),
      taskResetEligibleAt: null, taskResetStatus: 'available',
      withdrawalEligible: true, lastWithdrawalAt: null,
      createdAt: new Date(Date.now() - 20 * 86400000).toISOString(), approvedAt: new Date(Date.now() - 19 * 86400000).toISOString()
    };
    const pendingUser = {
      id: 'demo003', username: 'rafi99', fullName: 'Rafi Ahmed',
      phone: '+8801712345678', email: 'rafi@example.com', country: 'Bangladesh',
      passwordHash: FW.hash('Worker@123'), tier: 'demo', status: 'pending',
      balance: 0, totalEarned: 0, totalDeposited: 0, totalWithdrawn: 0, pendingWithdrawal: 0,
      registrationTxid: 'DEMO_TXID_003', registrationScreenshot: '',
      tasksTotal: 0, tasksCompleted: 0, tasksPending: 0, tasksApproved: 0, tasksRejected: 0,
      taskSlots: [], maxTasks: 10,
      lastTaskCompletedAt: null, taskResetEligibleAt: null, taskResetStatus: 'available',
      withdrawalEligible: false, lastWithdrawalAt: null,
      createdAt: new Date(Date.now() - 1 * 86400000).toISOString()
    };
    FW.db.setList('users', [demoUser, silverUser, pendingUser]);

    // Tasks
    FW.db.setList('tasks', [
      { id: 't001', photo: '', title: 'Visit Website & Take Screenshot', description: 'Visit our product page, scroll to the bottom, and take a full-page screenshot as proof.', link: 'https://example.com', reward: 0.50, tier: 'demo', type: 'normal', status: 'active', assignedUser: null, campaignId: null, createdAt: new Date().toISOString(), completions: 0, maxCompletions: 500 },
      { id: 't002', photo: '', title: 'Follow & Screenshot Social Media', description: 'Follow our social media account and take a screenshot showing you followed.', link: 'https://example.com/social', reward: 0.75, tier: 'demo', type: 'normal', status: 'active', assignedUser: null, campaignId: null, createdAt: new Date().toISOString(), completions: 0, maxCompletions: 300 },
      { id: 't003', photo: '', title: 'Premium Product Review', description: 'Write a 50+ word review of our product and submit with screenshot.', link: 'https://example.com/product', reward: 2.00, tier: 'silver', type: 'normal', status: 'active', assignedUser: null, campaignId: null, createdAt: new Date().toISOString(), completions: 0, maxCompletions: 100 },
      { id: 't004', photo: '', title: 'App Install & Screenshot', description: 'Install our mobile app, open it, and send a screenshot of the home screen.', link: 'https://example.com/app', reward: 1.50, tier: 'demo', type: 'normal', status: 'active', assignedUser: null, campaignId: null, createdAt: new Date().toISOString(), completions: 0, maxCompletions: 200 },
      { id: 't005', photo: '', title: 'Gold Tier Survey', description: 'Complete our detailed market survey and submit your answers.', link: 'https://example.com/survey', reward: 5.00, tier: 'gold', type: 'normal', status: 'active', assignedUser: null, campaignId: null, createdAt: new Date().toISOString(), completions: 0, maxCompletions: 50 }
    ]);

    // Campaigns
    FW.db.setList('campaigns', [
      { id: 'c001', title: 'Product Promotion Campaign', description: 'Promote our new product line across social media platforms.', type: 'normal', tier: 'demo', assignedUser: null, status: 'active', reward: 3.00, startDate: null, endDate: null, createdAt: new Date().toISOString() },
      { id: 'c002', title: 'Silver Influencer Campaign', description: 'Exclusive campaign for Silver tier members.', type: 'normal', tier: 'silver', assignedUser: null, status: 'active', reward: 8.00, startDate: null, endDate: null, createdAt: new Date().toISOString() }
    ]);

    // Submissions for demo user
    FW.db.setList('submissions', [
      { id: 's001', userId: 'demo001', taskId: 't001', taskTitle: 'Visit Website & Take Screenshot', note: 'Visited and took screenshot', screenshot: '', link: '', reward: 0.50, status: 'approved', submittedAt: new Date(Date.now() - 2 * 86400000).toISOString(), reviewedAt: new Date(Date.now() - 1 * 86400000).toISOString() },
      { id: 's002', userId: 'demo001', taskId: 't002', taskTitle: 'Follow & Screenshot Social Media', note: 'Followed and screenshotted', screenshot: '', link: '', reward: 0.75, status: 'pending', submittedAt: new Date(Date.now() - 86400000).toISOString(), reviewedAt: null },
      { id: 's003', userId: 'demo002', taskId: 't003', taskTitle: 'Premium Product Review', note: 'Great product!', screenshot: '', link: '', reward: 2.00, status: 'approved', submittedAt: new Date(Date.now() - 3 * 86400000).toISOString(), reviewedAt: new Date(Date.now() - 2 * 86400000).toISOString() }
    ]);

    // Notifications
    FW.db.setList('notifications', [
      { id: 'n001', userId: 'demo001', title: 'Welcome to FreeWork!', message: 'Your account has been approved. Start completing tasks to earn rewards!', type: 'account', read: false, createdAt: new Date(Date.now() - 4 * 86400000).toISOString() },
      { id: 'n002', userId: 'demo001', title: 'Task Approved', message: 'Your task "Visit Website & Take Screenshot" was approved. $0.50 added to your balance.', type: 'task', read: false, createdAt: new Date(Date.now() - 86400000).toISOString() },
      { id: 'n003', userId: 'demo002', title: '🎉 Withdrawal Unlocked!', message: 'You have completed all 10 tasks! You can now request a withdrawal.', type: 'withdrawal', read: false, createdAt: new Date(Date.now() - 86400000).toISOString() }
    ]);

    FW.db.setList('deposits', [
      { id: 'dep001', userId: 'demo001', amount: 5.00, method: 'USDC', txid: 'TXID_DEP_001', screenshot: '', status: 'approved', submittedAt: new Date(Date.now() - 5 * 86400000).toISOString(), reviewedAt: new Date(Date.now() - 4 * 86400000).toISOString() }
    ]);

    FW.db.setList('withdrawals', []);
    FW.db.setList('events', []);
    FW.db.setList('auditLog', []);
    FW.db.set('seeded', true);
  }
};

// Auto-seed on load
FW.seed();
