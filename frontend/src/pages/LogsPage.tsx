import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { api } from '../api/client'
import CustomSelect, { type Option } from '../components/shared/CustomSelect'
import CustomTable, { type Column } from '../components/shared/CustomTable'
import { useAuth } from '../context/AuthContext'
import type { AuditLog, User } from '../types'

export default function LogsPage() {
	const { role } = useAuth()
	// guard in UI; backend also enforces
	if (role !== 'admin') {
		return <p className='text-sm text-rose-600'>Access denied</p>
	}

	const usersQuery = useQuery({
		queryKey: ['users'],
		queryFn: async () => (await api.get<User[]>('/auth/users')).data,
	})
	const [selectedUser, setSelectedUser] = useState<string>('')

	const logsQuery = useQuery({
		queryKey: ['logs', selectedUser],
		queryFn: async () => {
			const res = await api.get<AuditLog[]>('/api/logs', {
				params: { user_id: selectedUser || undefined, limit: 1000 },
			})
			return res.data
		},
	})

	const userOptions: Option<string>[] = useMemo(
		() =>
			([{ label: 'All users', value: '' }] as Option<string>[]).concat(
				(usersQuery.data ?? []).map(u => ({ label: u.email, value: u.id }))
			),
		[usersQuery.data]
	)

	const columns: Array<Column<AuditLog & { user_email?: string }>> = [
		{
			key: 'created_at',
			header: 'When',
			render: row => (
				<span className='whitespace-nowrap text-xs'>
					{new Date(row.created_at).toLocaleString()}
				</span>
			),
		},
		{
			key: 'user_id',
			header: 'User',
			render: row => {
				const email =
					usersQuery.data?.find(u => u.id === (row.user_id as string))?.email ||
					'—'
				return <span className='text-xs'>{email}</span>
			},
		},
		{ key: 'action', header: 'Action' },
		{ key: 'entity', header: 'Entity' },
		{
			key: 'meta',
			header: 'Details',
			render: row => (
				<pre className='max-w-[480px] overflow-auto text-xs text-slate-700'>
					{JSON.stringify(row.meta ?? {}, null, 2)}
				</pre>
			),
		},
	]

	return (
		<div className='space-y-4'>
			<div className='flex items-center justify-between'>
				<h1 className='text-xl font-semibold text-slate-900'>Global logs</h1>
				<div className='w-72'>
					<CustomSelect
						placeholder='All users'
						options={userOptions}
						value={
							userOptions.find(o => o.value === selectedUser) ?? userOptions[0]
						}
						onChange={opt => setSelectedUser(opt.value)}
					/>
				</div>
			</div>

			<CustomTable
				columns={columns}
				data={logsQuery.data ?? []}
				pageParamKey='global_logs'
			/>
		</div>
	)
}
