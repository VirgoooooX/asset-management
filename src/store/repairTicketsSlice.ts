import { PayloadAction, SerializedError, createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import type { RepairStatus, RepairTicket } from '../types'
import * as repairTicketService from '../services/repairTicketService'
import type { RootState } from './index'

interface RepairTicketsState {
  tickets: RepairTicket[]
  loading: boolean
  refreshing: boolean
  submitting: boolean
  lastFetchedAt: number | null
  error: string | null
}

const initialState: RepairTicketsState = {
  tickets: [],
  loading: false,
  refreshing: false,
  submitting: false,
  lastFetchedAt: null,
  error: null,
}

const upsertTicketItem = (items: RepairTicket[], ticket: RepairTicket) => {
  const index = items.findIndex((t) => t.id === ticket.id)
  if (index === -1) {
    items.unshift(ticket)
    return
  }
  items[index] = ticket
}

export const fetchRepairTickets = createAsyncThunk<
  RepairTicket[],
  { status?: RepairStatus; assetId?: string; force?: boolean } | undefined,
  { rejectValue: string }
>(
  'repairTickets/fetchRepairTickets',
  async (filters, { rejectWithValue }) => {
    try {
      return await repairTicketService.getRepairTickets(filters)
    } catch (error: any) {
      return rejectWithValue(error.message || '获取维修工单失败')
    }
  },
  {
    condition: (filters, { getState }) => {
      if (filters?.force) return true
      const state = (getState() as RootState).repairTickets
      if (state.loading || state.refreshing) return false
      if (state.lastFetchedAt !== null && Date.now() - state.lastFetchedAt < 60 * 1000) return false
      return true
    },
  }
)

export const addRepairTicket = createAsyncThunk<
  RepairTicket,
  { assetId: string; problemDesc: string; startedAt?: string; expectedReturnAt?: string },
  { rejectValue: string }
>('repairTickets/addRepairTicket', async (data, { rejectWithValue }) => {
  try {
    return await repairTicketService.createRepairTicket(data)
  } catch (error: any) {
    return rejectWithValue(error.message || '创建维修工单失败')
  }
})

export const updateRepairTicket = createAsyncThunk<
  RepairTicket,
  {
    id: string
    changes: Partial<Pick<RepairTicket, 'problemDesc' | 'startedAt' | 'vendorName' | 'quoteAmount' | 'expectedReturnAt' | 'attachments'>>
  },
  { rejectValue: string }
>('repairTickets/updateRepairTicket', async ({ id, changes }, { rejectWithValue }) => {
  try {
    return await repairTicketService.updateRepairTicket(id, changes)
  } catch (error: any) {
    return rejectWithValue(error.message || '更新维修工单失败')
  }
})

export const deleteRepairTicket = createAsyncThunk<string, string, { rejectValue: string }>(
  'repairTickets/deleteRepairTicket',
  async (id, { rejectWithValue }) => {
    try {
      await repairTicketService.deleteRepairTicket(id)
      return id
    } catch (error: any) {
      return rejectWithValue(error.message || '删除维修工单失败')
    }
  }
)

export const transitionRepairTicketStatus = createAsyncThunk<
  RepairTicket,
  { id: string; to: RepairStatus; note?: string; vendorName?: string; quoteAmount?: number },
  { rejectValue: string }
>('repairTickets/transitionRepairTicketStatus', async (args, { rejectWithValue }) => {
  try {
    return await repairTicketService.transitionRepairTicketStatus(args)
  } catch (error: any) {
    return rejectWithValue(error.message || '更新维修状态失败')
  }
})

const repairTicketsSlice = createSlice({
  name: 'repairTickets',
  initialState,
  reducers: {
    upsertTicket(state, action: PayloadAction<RepairTicket>) {
      upsertTicketItem(state.tickets, action.payload)
    },
  },
  extraReducers: (builder) => {
    const handleMutationPending = (state: RepairTicketsState) => {
      state.submitting = true
      state.error = null
    }
    const handleUpsertFulfilled = (state: RepairTicketsState, action: PayloadAction<RepairTicket>) => {
      upsertTicketItem(state.tickets, action.payload)
      state.submitting = false
    }
    const handleMutationRejected =
      (fallback: string) =>
      (state: RepairTicketsState, action: PayloadAction<string | undefined, string, unknown, SerializedError>) => {
        state.submitting = false
        state.error = action.payload || action.error.message || fallback
      }

    builder
      .addCase(fetchRepairTickets.pending, (state) => {
        if (state.tickets.length > 0) state.refreshing = true
        else state.loading = true
        state.error = null
      })
      .addCase(fetchRepairTickets.fulfilled, (state, action: PayloadAction<RepairTicket[]>) => {
        state.tickets = action.payload
        state.loading = false
        state.refreshing = false
        state.lastFetchedAt = Date.now()
      })
      .addCase(
        fetchRepairTickets.rejected,
        (state, action: PayloadAction<string | undefined, string, unknown, SerializedError>) => {
          state.loading = false
          state.refreshing = false
          state.error = action.payload || action.error.message || '获取维修工单失败 (未知错误)'
        }
      )
      .addCase(addRepairTicket.pending, handleMutationPending)
      .addCase(addRepairTicket.fulfilled, handleUpsertFulfilled)
      .addCase(addRepairTicket.rejected, handleMutationRejected('创建维修工单失败 (未知错误)'))
      .addCase(updateRepairTicket.pending, handleMutationPending)
      .addCase(updateRepairTicket.fulfilled, handleUpsertFulfilled)
      .addCase(updateRepairTicket.rejected, handleMutationRejected('更新维修工单失败 (未知错误)'))
      .addCase(transitionRepairTicketStatus.pending, handleMutationPending)
      .addCase(transitionRepairTicketStatus.fulfilled, handleUpsertFulfilled)
      .addCase(transitionRepairTicketStatus.rejected, handleMutationRejected('更新维修状态失败 (未知错误)'))
      .addCase(deleteRepairTicket.pending, handleMutationPending)
      .addCase(deleteRepairTicket.fulfilled, (state, action: PayloadAction<string>) => {
        state.tickets = state.tickets.filter((t) => t.id !== action.payload)
        state.submitting = false
      })
      .addCase(deleteRepairTicket.rejected, handleMutationRejected('删除维修工单失败 (未知错误)'))
  },
})

export const { upsertTicket } = repairTicketsSlice.actions

export default repairTicketsSlice.reducer
