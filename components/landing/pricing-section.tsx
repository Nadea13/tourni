"use client";

import React from "react";
import { motion } from "motion/react";
import { Check, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/routing";

export function PricingSection() {
  
  const plans = [
    {
      id: "match",
      name: "Match",
      description: "เหมาะสำหรับทัวร์นาเมนต์ขนาดเล็กหรือผู้เริ่มต้นจัดแข่งขัน",
      priceMonthly: 0,
            priceLabel: "ตลอดชีพ",
      popular: false,
      ctaText: "เริ่มต้นใช้งานฟรี",
      ctaHref: "/sign-up",
      ctaVariant: "outline" as const,
      features: [
        "สร้างทัวร์นาเมนต์สูงสุด 1 รายการ",
        "สร้างรุ่นการแข่งขันสูงสุด 1 รุ่น",
        "จำกัดจำนวนทีมสูงสุด 12 ทีม",
        "จัดทัวร์นาเมนต์ได้สูงสุดไม่เกิน 30 วัน (เหมาะกับทัวร์สุดสัปดาห์/ทัวร์สั้น)",
        "ระบบรับเงินค่าสมัครผ่าน QR Code พร้อมแนบสลิป",
        "บันทึกเหตุการณ์สดแบบเรียลไทม์",
        "OBS Live Scoreboard Overlay",
      ],
    },
    {
      id: "event",
      name: "Event",
      description: "จัดทัวร์นาเมนต์แบบมืออาชีพพร้อมระบบที่สมบูรณ์แบบ",
      priceMonthly: 145,
      originalMonthly: 290,
            priceLabel: "/ ครั้ง",
      popular: false,
      discountBadge: "-50% โปรเปิดตัว",
      ctaText: "สมัครแพ็คเกจ Event",
      ctaHref: "/sign-up",
      ctaVariant: "outline" as const,
      features: [
        "สร้างทัวร์นาเมนต์ได้สูงสุด 1 รายการ",
        "สร้างรุ่นการแข่งขันสูงสุด 3 รุ่นต่อทัวร์นาเมนต์",
        "จำกัดจำนวนทีมสูงสุด 32 ทีม",
        "จัดทัวร์นาเมนต์ได้สูงสุดไม่เกิน 90 วัน (3 เดือน)",
        "บันทึกเหตุการณ์สด / ผู้ทำประตู / ฟาวล์",
        "เพิ่มสตาฟดูแลร่วมกัน 3 คน",
        "ระบบรับเงินค่าสมัครผ่าน QR Code พร้อมแนบสลิป",
        "OBS Live Scoreboard Overlay",
      ],
    },
    {
      id: "tournament",
      name: "Tournament",
      description: "จัดทัวร์นาเมนต์ขนาดใหญ่และลีกประสิทธิภาพสูง",
      priceMonthly: 295,
      originalMonthly: 590,
      priceLabel: "/ ครั้ง",
      popular: true,
      discountBadge: "-50% โปรเปิดตัว",
      ctaText: "สมัครแพ็คเกจ Tournament",
      ctaHref: "/sign-up",
      ctaVariant: "default" as const,
      features: [
        "สร้างทัวร์นาเมนต์ได้สูงสุด 3 รายการ",
        "สร้างรุ่นการแข่งขันสูงสุด 7 รุ่นต่อทัวร์นาเมนต์",
        "จำกัดจำนวนทีมสูงสุด 128 ทีมต่อรุ่น",
        "จัดลีกยาวได้ 3 - 6 เดือน (รองรับการแข่งขันระยะยาว)",
        "บันทึกเหตุการณ์สดแบบเรียลไทม์",
        "เพิ่มสตาฟดูแลการแข่งขันร่วมกันสูงสุด 7 คน",
        "ระบบรับเงินค่าสมัครผ่าน QR Code พร้อมแนบสลิป",
        "OBS Live Scoreboard Overlay",
      ],
    },
  ];

  return (
    <section className="py-20 lg:py-28 border-b relative overflow-hidden bg-background" id="pricing">
      {/* Subtle background gradient */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 lg:mb-16 space-y-4">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-foreground">
            แผนราคาที่เหมาะกับขนาดทัวร์นาเมนต์ของคุณ
          </h2>

          <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">
            เลือกแพ็กเกจที่ตอบโจทย์ ตั้งแต่ลีกกระชับมิตรขนาดย่อม ไปจนถึงทัวร์นาเมนต์ระดับประเทศ
          </p>
        </div>

          {/* Single Unified Card for Pricing (4 Compartments) */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-sm border border-border bg-border overflow-hidden shadow-2xl shadow-primary/5 grid grid-cols-1 md:grid-cols-3 gap-[1px] backdrop-blur-md"
        >
          {plans.map((plan) => {
            const isEvent = plan.popular;

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col justify-between p-6 sm:p-8 transition-colors duration-300 ${
                  isEvent
                    ? "bg-gradient-to-b from-card via-card/95 to-primary/[0.04] shadow-inner"
                    : "bg-card hover:bg-card/90"
                }`}
              >
                {/* Popular Pill */}
                {isEvent && (
                  <div className="inline-flex items-center gap-1 self-start bg-gradient-to-r from-primary via-primary to-emerald-400 text-primary-foreground text-[10px] font-black px-3 py-0.5 rounded-sm tracking-wider shadow-xs mb-3">
                    <Sparkles className="h-4 w-4" /> ยอดนิยม
                  </div>
                )}

                <div>
                  {/* Title & Discount Badge */}
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl sm:text-2xl font-black text-foreground">{plan.name}</h3>
                    {plan.discountBadge && (
                      <Badge variant="default" className="rounded-sm">
                        {plan.discountBadge}
                      </Badge>
                    )}
                  </div>

                  <p className="text-muted-foreground text-xs leading-relaxed mb-6 min-h-[32px]">
                    {plan.description}
                  </p>

                  {/* Price Block */}
                  <div className="mb-6 pb-6 border-b border-border">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      {plan.originalMonthly && (
                        <span className="text-base font-bold line-through text-muted-foreground/60">
                          ฿{plan.originalMonthly.toLocaleString()}
                        </span>
                      )}
                      <span className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
                        ฿{plan.priceMonthly.toLocaleString()}
                      </span>
                      <span className="text-xs text-muted-foreground font-medium">
                        {plan.priceLabel}
                      </span>
                    </div>
                  </div>

                  {/* Feature Checklist */}
                  <ul className="space-y-3 text-xs sm:text-sm text-foreground/90 mb-8">
                    {plan.features.map((feature, fIdx) => (
                      <li key={fIdx} className="flex items-start gap-2.5">
                        <div className="w-4 h-4 rounded-sm bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="h-4 w-4 stroke-[3]" />
                        </div>
                        <span className="leading-snug text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* CTA Button */}
                <div className="pt-2">
                  {('isExternal' in plan && plan.isExternal) ? (
                    <Button
                      variant={plan.ctaVariant}
                      className="w-full h-11 font-bold text-sm cursor-pointer shadow-xs hover:border-primary/40 rounded-sm"
                      asChild
                    >
                      <a href={plan.ctaHref} target="_blank" rel="noopener noreferrer">
                        {plan.ctaText}
                      </a>
                    </Button>
                  ) : (
                    <Button
                      variant={plan.ctaVariant}
                      className={`w-full h-11 font-bold text-sm cursor-pointer shadow-xs group rounded-sm ${
                        isEvent ? "shadow-md shadow-primary/20" : "hover:border-primary/40"
                      }`}
                      asChild
                    >
                      <Link href={plan.ctaHref}>
                        {plan.ctaText}
                        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
