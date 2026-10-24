import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { PublicNavbar } from "@/components/layout/public-navbar";
import { getServerSession } from "@/lib/auth-server";
import { PublicFooter } from "@/components/layout/public-footer";
import { FaqSection } from "@/components/landing/faq-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { SportsMarquee } from "@/components/landing/sports-marquee";
import { PricingSection } from "@/components/landing/pricing-section";
import { CtaSection } from "@/components/landing/cta-section";
import { HeroDotBackground } from "@/components/landing/hero-dot-background";
import { ProductShowcaseSection } from "@/components/landing/product-showcase-section";
import { getLocale } from "next-intl/server";

export default async function Home() {
  const locale = await getLocale();
  const session = await getServerSession();
  const user = session?.user || null;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Navbar */}
      <PublicNavbar user={user} />

      <main className="flex-1 relative">
        {/* Hero Section (Sticky full screen with Marquee at bottom) */}
        <section className="sticky top-0 z-0 overflow-hidden min-h-screen flex flex-col justify-between border-b bg-background pt-20 pb-8 lg:pt-24 lg:pb-10">
          {/* Interactive Canvas Dot Background */}
          <HeroDotBackground />

          {/* Ambient Fade overlay */}
          <div className="absolute inset-0 bg-gradient-to-tr from-background via-background/90 to-background/50 pointer-events-none z-[1]" />
          
          <div className="container max-w-7xl mx-auto relative z-10 px-2 lg:px-0 my-auto py-8">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              {/* Left Column: Copy & Call to Action */}
              <div className="flex flex-col space-y-6 lg:space-y-8 text-center lg:text-left">
                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.15] break-words">
                  <span className="block">ระบบรับสมัครทีมและ</span>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-primary/80 to-[#00C49A] block sm:inline-block">
                    จัดการการแข่งขันแบบครบวงจร
                  </span>
                </h1>

                <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto lg:mx-0 leading-relaxed">
                  แพลตฟอร์มที่ช่วยให้คุณจัดลีค สร้างทัวร์นาเมนต์ รับสมัครทีม และสรุปผลการแข่งขันได้อย่างมืออาชีพ สะดวก รวดเร็ว และครบครันในที่เดียว
                </p>

                <div className="flex flex-col sm:flex-row gap-2 lg:gap-4 justify-center lg:justify-start pt-2">
                  <Button size="lg" className="h-12 px-8 font-semibold text-base group shadow-lg shadow-primary/20 cursor-pointer" asChild>
                    <Link href={user ? "/home" : "/sign-up"}>
                      {user ? (locale === 'th' ? "หน้าหลัก" : "Home") : (locale === 'th' ? "สร้างทัวร์นาเมนต์ของคุณ" : "Create Tournament")}
                      <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" className="h-12 px-8 font-semibold text-base cursor-pointer" asChild>
                    <Link href="/overlay">
                      ลองใช้งาน Live Overlay ฟรี
                    </Link>
                  </Button>
                </div>
              </div>

              {/* Right Column: 3 Node Bracket Visualization */}
              <div className="relative w-full py-4 overflow-visible">
                {/* Scrollable wrapper */}
                <div className="w-full overflow-x-auto py-2 scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <div className="flex justify-start lg:justify-center px-4 lg:px-0">
                    {/* Bracket Layout container */}
                    <div className="flex items-center gap-16 relative z-10 w-[544px] shrink-0 h-[360px] scale-90 sm:scale-100 origin-left lg:origin-center">
                      {/* Connection Lines (SVG) */}
                      <svg
                        viewBox="0 0 544 360"
                        className="absolute inset-0 w-[544px] h-[360px] pointer-events-none z-0"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <g fill="none" strokeWidth="2">
                          {/* Match 1 Winner -> Finals Left Center */}
                          <path d="M 240 60 C 272 60, 272 180, 304 180" stroke="var(--color-node-2, #00C692)" />
                          {/* Match 2 Winner -> Finals Left Center */}
                          <path d="M 240 300 C 272 300, 272 180, 304 180" stroke="var(--color-node-2, #00C692)" />
                        </g>
                      </svg>

                      {/* Left Column (Semifinals) */}
                      <div className="flex flex-col justify-between h-[360px] w-[240px] z-10">
                        {/* Match 1 */}
                        <div className="w-full h-[120px] bg-card border rounded-sm shadow-md hover:shadow-lg transition-all duration-300 hover:border-primary/50 relative">
                          {/* Single Output Handle on Right Center */}
                          <div className="absolute h-4 w-4 bg-card border border-border rounded-full -right-[5px] top-1/2 -translate-y-1/2 z-20" />

                          <div className="flex items-center px-4 py-2 border-b justify-between bg-muted/20 rounded-t-sm">
                            <div className="flex items-center gap-2">
                              <div className="h-4 w-4 bg-node-2 rounded flex items-center justify-center">
                                <span className="text-background text-[10px] font-bold">VS</span>
                              </div>
                              <span className="text-[10px] font-black tracking-wide text-node-2">
                                Match
                              </span>
                              <span className="text-[10px] font-black tracking-wide text-muted-foreground">
                                SEMIFINALS #1
                              </span>
                            </div>
                          </div>
                          <div className="p-4 space-y-1.5 text-sm">
                            <div className="flex justify-between items-center font-bold">
                              <span className="flex items-center gap-1.5">
                                Alpha FC
                              </span>
                              <span>2</span>
                            </div>
                            <div className="flex justify-between items-center text-muted-foreground">
                              <span className="flex items-center gap-1.5">
                                Beta United
                              </span>
                              <span>1</span>
                            </div>
                          </div>
                        </div>

                        {/* Match 2 */}
                        <div className="w-full h-[120px] bg-card border rounded-sm shadow-md hover:shadow-lg transition-all duration-300 hover:border-primary/50 relative">
                          {/* Single Output Handle on Right Center */}
                          <div className="absolute h-4 w-4 bg-card border border-border rounded-full -right-[5px] top-1/2 -translate-y-1/2 z-20" />

                          <div className="flex items-center px-4 py-2 border-b justify-between bg-muted/20 rounded-t-sm">
                            <div className="flex items-center gap-2">
                              <div className="h-4 w-4 bg-node-2 rounded flex items-center justify-center">
                                <span className="text-background text-[10px] font-bold">VS</span>
                              </div>
                              <span className="text-[10px] font-black tracking-wide text-node-2">
                                Match
                              </span>
                              <span className="text-[10px] font-black tracking-wide text-muted-foreground">
                                SEMIFINALS #2
                              </span>
                            </div>
                          </div>
                          <div className="p-4 space-y-1.5 text-sm">
                            <div className="flex justify-between items-center text-muted-foreground">
                              <span className="flex items-center">
                                Gamma CF
                              </span>
                              <span>0</span>
                            </div>
                            <div className="flex justify-between items-center font-bold">
                              <span className="flex items-center">
                                Delta SC
                              </span>
                              <span>2</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right Column (Finals) */}
                      <div className="flex items-center h-[360px] w-[240px] z-10">
                        {/* Match 3 (Finals) */}
                        <div className="w-full h-[120px] bg-card border rounded-sm shadow-md hover:shadow-lg transition-all duration-300 hover:border-primary/50 relative">
                          {/* Single Input Handle on Left Center */}
                          <div className="absolute h-4 w-4 bg-card border border-border rounded-full -left-[5px] top-1/2 -translate-y-1/2 z-20" />
                          <div className="flex items-center px-4 py-2 border-b justify-between bg-muted/20 rounded-t-sm">
                            <div className="flex items-center gap-2">
                              <div className="h-4 w-4 bg-node-2 rounded flex items-center justify-center">
                                <span className="text-background text-[10px] font-bold">VS</span>
                              </div>
                              <span className="text-[10px] font-black tracking-wide text-node-2">
                                Match
                              </span>
                              <span className="text-[10px] font-black tracking-wide text-muted-foreground">
                                GRAND FINALS
                              </span>
                            </div>
                            <span className="flex items-center gap-1.5 text-red-500 px-1.5 py-0.5 rounded font-black text-[9px] animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            </span>
                          </div>
                          <div className="p-4 space-y-1.5 text-sm font-semibold relative z-10">
                            <div className="flex justify-between items-center">
                              <span className="flex items-center gap-2">
                                Alpha FC
                              </span>
                              <span className="font-extrabold">0</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="flex items-center gap-2">
                                Delta SC
                              </span>
                              <span className="font-extrabold">0</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Right fade-out indicator for horizontal scroll */}
                <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-background via-background/60 to-transparent pointer-events-none z-20 lg:hidden" />
              </div>
            </div>
          </div>

          {/* Marquee embedded at bottom of Hero */}
          <div className="relative z-10 w-full pt-4 pb-2">
            <SportsMarquee showTitle={false} />
          </div>
        </section>

        {/* Content sections that slide up to replace Hero */}
        <div className="relative z-10 bg-background shadow-2xl">
          {/* Product Real Previews Showcase Section */}
          <ProductShowcaseSection />

          {/* Features Section */}
          <FeaturesSection />

          {/* Pricing Section */}
          <PricingSection />

          {/* FAQ Section for SEO & User Guide */}
          <FaqSection locale={locale} />

          {/* Call to Action Section */}
          <CtaSection />
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
