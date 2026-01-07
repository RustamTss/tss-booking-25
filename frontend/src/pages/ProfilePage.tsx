import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { api } from '../api/client'
import CustomInput from '../components/shared/CustomInput'
import { useToast } from '../components/shared/ui/ToastProvider'
import type { User } from '../types'

function ProfilePage() {
	const { success, error } = useToast()

	const meQuery = useQuery({
		queryKey: ['me'],
		queryFn: async () => (await api.get<User>('/auth/me')).data,
	})

	const [form, setForm] = useState({ email: '', password: '' })

	// Prefill email from authenticated user once loaded
	useEffect(() => {
		if (meQuery.data?.email) {
			setForm(prev => ({ ...prev, email: meQuery.data!.email }))
		}
	}, [meQuery.data?.email])

	const updateMutation = useMutation({
		mutationFn: async () => {
			if (!meQuery.data?.id) return
			await api.put(`/auth/users/${meQuery.data.id}`, {
				email: form.email || undefined,
				password: form.password || undefined,
			})
		},
		onSuccess: () => {
			success('Profile updated')
		},
		onError: () => error('Failed to update profile'),
	})

	return (
		<div className='space-y-4'>
			<div>
				<h1 className='text-xl font-semibold text-slate-900'>Profile</h1>
				<p className='text-sm text-slate-600'>Update your credentials</p>
			</div>
			<div className='rounded-xl border border-slate-200 bg-white p-4 shadow-sm'>
				<div className='grid gap-3 sm:grid-cols-2'>
					<CustomInput
						label='Email'
						value={form.email}
						onChange={v => setForm({ ...form, email: v })}
						placeholder={meQuery.data?.email || 'email@example.com'}
						autoFocus
					/>
					<CustomInput
						label='New password (optional)'
						value={form.password}
						onChange={v => setForm({ ...form, password: v })}
						placeholder='******'
					/>
				</div>
				<div className='mt-3 flex justify-end'>
					<button
						type='button'
						onClick={() => updateMutation.mutate()}
						disabled={updateMutation.isPending}
						className='rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60'
					>
						{updateMutation.isPending ? 'Saving...' : 'Save'}
					</button>
				</div>
			</div>
		</div>
	)
}

export default ProfilePage
