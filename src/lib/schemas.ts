import { z } from "zod";

export const guestLookupSchema = z.object({
  query: z.string().trim().min(2, "Enter at least 2 characters."),
});

export const rsvpSubmitSchema = z.object({
  inviteCode: z.string().trim().min(1),
  inviteToken: z.string().trim().min(8),
  fullName: z.string().trim().min(2),
  email: z.string().trim().email().optional().or(z.literal("")),
  attendance: z.enum(["attending", "declined"]),
  guestCount: z.coerce.number().int().min(0).max(20),
  companionNames: z.array(z.string().trim().min(1).max(120)).optional().default([]),
  message: z.string().trim().max(500).optional().or(z.literal("")),
}).superRefine((data, ctx) => {
  if (data.attendance === "declined" && data.guestCount !== 0) {
    ctx.addIssue({
      code: "custom",
      message: "Guest count must be 0 when declining.",
      path: ["guestCount"],
    });
  }

  if (data.attendance === "attending" && data.guestCount < 1) {
    ctx.addIssue({
      code: "custom",
      message: "Guest count must be at least 1 when attending.",
      path: ["guestCount"],
    });
  }
});

export const createGuestSchema = z.object({
  inviteCode: z.string().trim().max(30).optional().or(z.literal("")),
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().optional().or(z.literal("")),
  maxGuests: z.coerce.number().int().min(1).max(20),
  notes: z.string().trim().max(250).optional().or(z.literal("")),
});

export const updateGuestSchema = z.object({
  rowNumber: z.coerce.number().int().min(2),
  fullName: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email().optional().or(z.literal("")).optional(),
  maxGuests: z.coerce.number().int().min(1).max(20).optional(),
  status: z.enum(["pending", "attending", "declined"]).optional(),
  notes: z.string().trim().max(250).optional().or(z.literal("")).optional(),
});

export const deleteGuestSchema = z.object({
  rowNumber: z.coerce.number().int().min(2),
});

export const updateWeddingDateSchema = z.object({
  weddingDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Wedding date must be in YYYY-MM-DD format.")
    .or(z.literal("")),
  weddingTime: z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Wedding time must be in HH:mm format.")
    .or(z.literal(""))
    .optional(),
  showCountdown: z.boolean().optional(),
});
