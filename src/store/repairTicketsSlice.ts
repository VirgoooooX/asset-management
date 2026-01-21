import { PayloadAction, SerializedError, createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import type { RepairStatus, RepairTicket } from '../types'
import * as repairTicketService from '../services/repairTicketService'

interface RepairTicketsState {
  tickets: RepairTicket[]
  loading: boolean
  error: string | null
}

const initialState: RepairTicketsState = {
  tickets: [],
  loading: false,
  error: null,
}

export const fetchRepairTickets = createAsyncThunk<
  RepairTicket[],
  { status?: RepairStatus; assetId?: string } | undefined,
  { rejectValue: string }
>('repairTickets/fetchRepairTickets', async (filters, { rejectWithValue }) => {
  try {
    return await repairTicketService.getRepairTickets(filters)
  } catch (error: any) {
    return rejectWithValue(error.message || '获取维修工单失败')
  }
})

export const addRepairTicket = createAsyncThunk<
  RepairTicket,
  { assetId: string; problemDesc: string; expectedReturnAt?: string },
  { rejectValue: string }
>('repairTickets/addRepairTicket', async (data, { rejectWithValue }) => {
  try {
    const id = await repairTicketService.createRepairTicket(data)
    const created = await repairTicketService.getRepairTicketById(id)
    if (!created) throw new Error('维修工单创建成功，但未能获取到创建后的数据。')
    return created
  } catch (error: any) {
    return rejectWithValue(error.message || '创建维修工单失败')
  }
})

export const updateRepairTicket = createAsyncThunk<
  RepairTicket,
  { id: string; changes: Partial<Pick<RepairTicket, 'problemDesc' | 'vendorName' | 'quoteAmount' | 'expectedReturnAt'>> },
  { rejectValue: string }
>('repairTickets/updateRepairTicket', async ({ id, changes }, { rejectWithValue }) => {
  try {
    await repairTicketService.updateRepairTicket(id, changes)
    const updated = await repairTicketService.getRepairTicketById(id)
    if (!updated) throw new Error('更新维修工单后未能检索到该工单。')
    return updated
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
    await repairTicketService.transitionRepairTicketStatus(args)
    const updated = await repairTicketService.getRepairTicketById(args.id)
    if (!updated) throw new Error('更新维修工单后未能检索到该工单。')
    return updated
  } catch (error: any) {
    return rejectWithValue(error.message || '更新维修状态失败')
  }
})

const repairTicketsSlice = createSlice({
  name: 'repairTickets',
  initialState,
  reducers: {
    upsertTicket(state, action: PayloadAction<RepairTicket>) {
      const index = state.tickets.findIndex((t) => t.id === action.payload.id)
      if (index === -1) {
        state.tickets.unshift(action.payload)
        return
      }
      state.tickets[index] = action.payload
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRepairTickets.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchRepairTickets.fulfilled, (state, action: PayloadAction<RepairTicket[]>) => {
        state.tickets = action.payload
        state.loading = false
      })
      .addCase(
        fetchRepairTickets.rejected,
        (state, action: PayloadAction<string | undefined, string, unknown, SerializedError>) => {
          state.loading = false
          state.error = action.payload || action.error.message || '获取维修工单失败 (未知错误)'
        }
      )
      .addCase(addRepairTicket.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(addRepairTicket.fulfilled, (state, action: PayloadAction<RepairTicket>) => {
        state.tickets.unshift(action.payload)
        state.loading = false
      })
      .addCase(
        addRepairTicket.rejected,
        (state, action: PayloadAction<string | undefined, string, unknown, SerializedError>) => {
          state.loading = false
          state.error = action.payload || action.error.message || '创建维修工单失败 (未知错误)'
        }
      )
      .addCase(updateRepairTicket.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(updateRepairTicket.fulfilled, (state, action: PayloadAction<RepairTicket>) => {
        const index = state.tickets.findIndex((t) => t.id === action.payload.id)
        if (index !== -1) state.tickets[index] = action.payload
        state.loading = false
      })
      .addCase(
        updateRepairTicket.rejected,
        (state, action: PayloadAction<string | undefined, string, unknown, SerializedError>) => {
          state.loading = false
          state.error = action.payload || action.error.message || '更新维修工单失败 (未知错误)'
        }
      )
      .addCase(transitionRepairTicketStatus.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(transitionRepairTicketStatus.fulfilled, (state, action: PayloadAction<RepairTicket>) => {
        const index = state.tickets.findIndex((t) => t.id === action.payload.id)
        if (index !== -1) state.tickets[index] = action.payload
        state.loading = false
      })
      .addCase(
        transitionRepairTicketStatus.rejected,
        (state, action: PayloadAction<string | undefined, string, unknown, SerializedError>) => {
          state.loading = false
          state.error = action.payload || action.error.message || '更新维修状态失败 (未知错误)'
        }
      )
      .addCase(deleteRepairTicket.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(deleteRepairTicket.fulfilled, (state, action: PayloadAction<string>) => {
        state.tickets = state.tickets.filter((t) => t.id !== action.payload)
        state.loading = false
      })
      .addCase(
        deleteRepairTicket.rejected,
        (state, action: PayloadAction<string | undefined, string, unknown, SerializedError>) => {
          state.loading = false
          state.error = action.payload || action.error.message || '删除维修工单失败 (未知错误)'
        }
      )
  },
})

export const { upsertTicket } = repairTicketsSlice.actions
export default repairTicketsSlice.reducer

