'use client';

import { useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Desk {
  _id: string;
  label: string;
  status: 'available' | 'reserved' | 'occupied' | 'maintenance';
  location?: string;
  description?: string;
  hourlyRate: number;
  createdAt: string;
  updatedAt: string;
}

export default function DesksPage() {
  const { token } = useAuth();
  const { data: desks, mutate, isLoading } = useApi<Desk[]>('/api/desks', { refreshInterval: 10000 });
  const { apiCall } = useApi();
  
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingDesk, setEditingDesk] = useState<Desk | null>(null);
  const [formData, setFormData] = useState<{
    label: string;
    location: string;
    description: string;
    hourlyRate: number;
    status: 'available' | 'reserved' | 'occupied' | 'maintenance';
  }>({
    label: '',
    location: '',
    description: '',
    hourlyRate: 10,
    status: 'available',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingDesk) {
        await apiCall(`/api/desks/${editingDesk._id}`, {
          method: 'PATCH',
          body: formData,
        });
      } else {
        await apiCall('/api/desks', {
          method: 'POST',
          body: formData,
        });
      }
      
      mutate();
      setShowCreateForm(false);
      setEditingDesk(null);
      setFormData({
        label: '',
        location: '',
        description: '',
        hourlyRate: 10,
        status: 'available',
      });
    } catch (error) {
      console.error('Error saving desk:', error);
      alert(error instanceof Error ? error.message : 'Failed to save desk');
    }
  };

  const handleEdit = (desk: Desk) => {
    setEditingDesk(desk);
    setFormData({
      label: desk.label,
      location: desk.location || '',
      description: desk.description || '',
      hourlyRate: desk.hourlyRate,
      status: desk.status,
    });
    setShowCreateForm(true);
  };

  const handleStatusChange = async (deskId: string, newStatus: string) => {
    try {
      await apiCall(`/api/desks/${deskId}`, {
        method: 'PATCH',
        body: { status: newStatus },
      });
      mutate();
    } catch (error) {
      console.error('Error changing desk status:', error);
      alert(error instanceof Error ? error.message : 'Failed to change desk status');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800';
      case 'reserved': return 'bg-blue-100 text-blue-800';
      case 'occupied': return 'bg-red-100 text-red-800';
      case 'maintenance': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading desks...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Desk Management</h1>
          <p className="text-gray-600">Manage your co-working desks</p>
        </div>
        <Button onClick={() => setShowCreateForm(true)}>
          Add New Desk
        </Button>
      </div>

      {/* Create/Edit Form */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingDesk ? 'Edit Desk' : 'Add New Desk'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Label*</label>
                  <Input
                    value={formData.label}
                    onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                    placeholder="e.g., A1, B2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Hourly Rate*</label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.hourlyRate}
                    onChange={(e) => setFormData({ ...formData, hourlyRate: parseFloat(e.target.value) })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Location</label>
                  <Input
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g., Window Side, Center"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  >
                    <option value="available">Available</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                  className="w-full p-2 border border-gray-300 rounded-md"
                  rows={3}
                />
              </div>
              <div className="flex space-x-2">
                <Button type="submit">
                  {editingDesk ? 'Update Desk' : 'Create Desk'}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setShowCreateForm(false);
                    setEditingDesk(null);
                    setFormData({
                      label: '',
                      location: '',
                      description: '',
                      hourlyRate: 10,
                      status: 'available',
                    });
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Desks Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Desks ({desks?.length || 0})</CardTitle>
          <CardDescription>Manage desk status and information</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Rate/Hour</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {desks?.map((desk) => (
                <TableRow key={desk._id}>
                  <TableCell className="font-medium">{desk.label}</TableCell>
                  <TableCell>{desk.location || '-'}</TableCell>
                  <TableCell>
                    <select
                      value={desk.status}
                      onChange={(e) => handleStatusChange(desk._id, e.target.value)}
                      className={`px-2 py-1 rounded-full text-xs font-medium border-0 ${getStatusColor(desk.status)}`}
                    >
                      <option value="available">Available</option>
                      <option value="reserved">Reserved</option>
                      <option value="occupied">Occupied</option>
                      <option value="maintenance">Maintenance</option>
                    </select>
                  </TableCell>
                  <TableCell>${desk.hourlyRate}/hr</TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(desk)}
                    >
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {(!desks || desks.length === 0) && (
            <div className="text-center py-8 text-gray-500">
              No desks found. Add your first desk to get started.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}