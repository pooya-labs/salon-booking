package com.pooyalabs.salonmanager

import org.junit.Assert.assertEquals
import org.junit.Test

class CoreLogicTest {
    @Test
    fun pendingBookingsCanOnlyBeConfirmedOrCancelled() {
        assertEquals(listOf("confirmed", "cancelled"), BookingTransitions.allowed("pending"))
    }

    @Test
    fun confirmedBookingsHaveTheExpectedFinalTransitions() {
        assertEquals(listOf("completed", "cancelled", "no_show"), BookingTransitions.allowed("confirmed"))
    }

    @Test
    fun finalBookingStatesCannotBeChangedAgain() {
        listOf("cancelled", "completed", "no_show").forEach {
            assertEquals(emptyList<String>(), BookingTransitions.allowed(it))
        }
    }

    @Test
    fun jalaliFormattingUsesTheSalonCalendar() {
        assertEquals("۱ فروردین ۱۴۰۵", JalaliDate.format("2026-03-21"))
        assertEquals("۲۲ آبان ۱۴۰۵", JalaliDate.format("2026-11-13"))
    }

    @Test
    fun nonDateInputIsReturnedWithoutCrashing() {
        assertEquals("", JalaliDate.format(""))
        assertEquals("نامعتبر", JalaliDate.format("نامعتبر"))
    }
}
