/**
 * UsersManagement — Admin page for managing all system users
 *
 * Features:
 * - Searchable, sortable, paginated user table
 * - Role-based filtering (Student, Instructor, Admin)
 * - Add new user modal with validation
 * - Edit user inline
 * - Delete user with confirmation
 * - Role badges with color coding
 * - Responsive design with horizontal scroll on mobile
 */

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Search, Plus, Edit, Trash2, Filter, X, ChevronDown } from 'lucide-react';
import { adminAPI } from '../../api';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import DataTable from '../../components/admin/Table';
import { Card, Button, Input, Select, Modal } from '../../components/ui';

export default function UsersManagement() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student' });
  const [submitting, setSubmitting] = useState(false);

  // Fetch users with optional role filter
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (roleFilter) params.set('role', roleFilter);
      const res = await adminAPI.getUsers(roleFilter);
      setUsers(res.data || []);
    } catch (err) {
      toast('Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  }, [roleFilter, toast]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Reset form to initial state
  const resetForm = () => {
    setForm({ name: '', email: '', password: '', role: 'student' });
    setEditingUser(null);
  };

  // Handle form submission (create or update)
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || (!form.password && !editingUser)) {
      toast('Name, email, and password are required', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      if (editingUser) {
        await adminAPI.updateUser(editingUser.id, { name: form.name, email: form.email, role: form.role });
        toast('User updated', 'success');
      } else {
        await adminAPI.createUser(form);
        toast('User created', 'success');
      }
      setShowForm(false);
      resetForm();
      fetchUsers();
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to save user', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle edit - populate form with user data
  const handleEdit = (user) => {
    setEditingUser(user);
    setForm({ name: user.name, email: user.email, password: '', role: user.role });
    setShowForm(true);
  };

  // Handle delete with confirmation
  const handleDelete = async (user) => {
    const ok = await confirm(
      `Delete ${user.name} (${user.email})? This action cannot be undone.`,
      { danger: true, title: 'Delete User', confirmText: 'Delete' }
    );
    if (!ok) return;
    try {
      await adminAPI.deleteUser(user.id);
      setUsers(users.filter((u) => u.id !== user.id));
      toast('User deleted', 'info');
    } catch (err) {
      toast(err.response?.data?.error || 'Failed to delete user', 'error');
    }
  };

  // Table column definitions
  const columns = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'email', label: 'Email', sortable: true },
    {
      key: 'role',
      label: 'Role',
      sortable: true,
      align: 'center',
      render: (row) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
          row.role === 'admin' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
          row.role === 'instructor' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
          'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
        }`}>
          {row.role}
        </span>
      ),
    },
    {
      key: 'created_at',
      label: 'Created',
      sortable: true,
      align: 'center',
      render: (row) => <span className="text-xs text-gray-500 dark:text-gray-400">{new Date(row.created_at).toLocaleDateString()}</span>,
    },
  ];

  // Row actions (edit/delete)
  const rowActions = [
    {
      key: 'edit',
      label: 'Edit',
      icon: Edit,
      variant: 'primary',
      onClick: handleEdit,
    },
    {
      key: 'delete',
      label: 'Delete',
      icon: Trash2,
      variant: 'danger',
      onClick: handleDelete,
    },
  ];

  // Filtered users for client-side search
  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Page Header with Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">User Management</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage system users, roles, and permissions</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }} icon={Plus} className="w-full sm:w-auto">
          Add User
        </Button>
      </div>

      {/* Search & Filter Bar */}
      <div className="card flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" aria-hidden="true" />
          <input
            type="search"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            aria-label="Search users"
          />
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <Filter className="w-4 h-4" aria-hidden="true" />
            <span>Role:</span>
          </label>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            aria-label="Filter by role"
          >
            <option value="">All Roles</option>
            <option value="student">Student</option>
            <option value="instructor">Instructor</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <DataTable
        columns={columns}
        data={filteredUsers}
        keyField="id"
        loading={loading}
        emptyMessage="No users found"
        rowActions={rowActions}
        pagination={{
          page: 1,
          pageSize: 10,
          total: filteredUsers.length,
        }}
      />

      {/* Add/Edit User Modal */}
      <Modal isOpen={showForm} onClose={() => { setShowForm(false); resetForm(); }} title={editingUser ? 'Edit User' : 'Add New User'}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Email *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="john@example.com"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">{editingUser ? 'New Password (leave blank to keep current)' : 'Password *'}</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required={!editingUser}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder={editingUser ? '••••••••' : 'Enter password'}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Role *</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="student">Student</option>
                <option value="instructor">Instructor</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button type="button" variant="secondary" onClick={() => { setShowForm(false); resetForm(); }}>
                Cancel
              </Button>
              <Button type="submit" loading={submitting}>
                {editingUser ? 'Update User' : 'Create User'}
              </Button>
            </div>
          </form>
        </Modal>
    </div>
  );
}