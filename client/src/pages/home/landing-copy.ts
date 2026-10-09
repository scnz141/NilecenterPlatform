/**
 * Landing page copy. English is the source; Arabic, Turkish, Chinese, Russian
 * and Urdu must match its shape (TypeScript enforces it). Facts come from nilecenter.edu.eg and the
 * previous landing page: founded 1998, Nasr City campuses, live online.
 */
export type LandingLocale = "en" | "ar" | "tr" | "zh" | "ru" | "ur";

const en = {
  langName: "English",
  notice: "Admissions are open. Placement tests and trial lessons are free.",
  where: "Nasr City, Cairo · Live online worldwide",
  nav: {
    programmes: "Programmes",
    start: "How to start",
    modes: "Online & campus",
    contact: "Contact",
    signIn: "Sign in",
    menu: "Menu",
    close: "Close menu",
    language: "Language",
    skip: "Skip to content",
  },
  hero: {
    eyebrow: "Arabic, Qur’an and Islamic studies since 1998",
    line1: "Learn with passion.",
    line2: "Succeed with",
    accent: "distinction.",
    lead: "Certified teachers, a plan built around your level, and classes live online or on campus in Nasr City, Cairo.",
    trial: "Book a free trial lesson",
    placement: "Book a placement test",
    note: "Every learner starts with a free 30-minute placement test.",
    chipOnline: "Live online, worldwide",
    chipCampus: "Two campuses in Nasr City",
    chipCertified: "Certified teachers",
  },
  stats: [
    { value: "1998", label: "Founded in Cairo" },
    { value: "120,000+", label: "Learners taught" },
    { value: "120", label: "Nationalities" },
    { value: "150", label: "Teachers" },
  ],
  programmes: {
    title: "Programmes",
    lead: "Eight paths, one standard of teaching. Every path begins at your level.",
    all: "See every programme",
    open: "Explore",
    items: [
      { slug: "quran", name: "Qur’an", desc: "Recitation for beginners, Tajweed, Hifz, Ijāzah, the seven and ten Qirā’āt.", meta: "Beginner to Ijāzah" },
      { slug: "arabic", name: "Arabic", desc: "Modern Standard, Egyptian Ammiyya, conversation, grammar and calligraphy.", meta: "A1 to advanced" },
      { slug: "islamic-studies", name: "Islamic studies", desc: "Qur’anic Arabic and guided foundations of Islamic studies.", meta: "Weekly live cohorts" },
      { slug: "kids", name: "Kids", desc: "Qur’an, Arabic and Islamic studies paths built for young learners.", meta: "Ages 5 to 14" },
      { slug: "turkish", name: "Turkish", desc: "Modern Turkish for study, travel and daily life.", meta: "A1 to B2" },
      { slug: "english", name: "English", desc: "General and academic English in small, focused groups.", meta: "All levels" },
      { slug: "teacher-training", name: "Teacher training", desc: "Method, classroom craft and assessment for teachers of Arabic and Qur’an.", meta: "For practising teachers" },
      { slug: "enterprise", name: "Organisations", desc: "Programmes designed with schools, companies, mosques and communities.", meta: "Built with you" },
    ],
  },
  wisdom: {
    meaning: "Knowledge is light.",
    text: "An old Arabic saying, and the reason Nile Center exists: every lesson should leave a learner seeing a little more clearly.",
  },
  teach: {
    title: "How we teach",
    lead: "Three habits every class shares, from a child’s first letters to an Ijāzah.",
    items: [
      { title: "A plan built to your level", text: "Every learner, from absolute beginner to Ijāzah candidate, gets a plan that starts where the placement test found them." },
      { title: "Live and interactive", text: "Real teachers, real conversation, in morning, afternoon and evening groups, with recordings to revise from." },
      { title: "Progress on record", text: "Attendance, grades and teacher feedback stay in one account, so you and your family always know where you stand." },
    ],
  },
  start: {
    title: "How you start",
    lead: "The same four steps for every learner, whatever the level.",
    steps: [
      { title: "Tell us your goal", text: "Send a short enquiry. An admissions advisor replies with the right options." },
      { title: "Free placement test", text: "Thirty minutes, online or on campus, so you start at exactly your level." },
      { title: "Free trial lesson", text: "Sit a real lesson with a certified teacher before you decide anything." },
      { title: "Join your class", text: "Pick a morning, afternoon or evening group. Your plan and progress live in one place." },
    ],
  },
  modes: {
    title: "Online or on campus",
    lead: "The same teachers and the same standard, wherever you learn.",
    online: {
      title: "Live online",
      text: "Interactive live classes with recorded lessons on your learning platform.",
      points: ["Join from anywhere in the world", "Morning, afternoon and evening groups", "Recordings and materials included"],
      phoneLabel: "Online courses",
    },
    campus: {
      title: "On campus in Cairo",
      text: "Two campuses in Nasr City with quiet classrooms and calligraphy studios.",
      points: ["Branch 1: 37 Abd Al-Shafy Mohammed, 7th District", "Branch 2: 6 Fadl ibn Rabea, 7th District", "Placement tests and trials on site"],
      phoneLabel: "Onsite courses",
    },
  },
  quotes: {
    title: "In our learners’ words",
    items: [
      { text: "My teachers guided me through the full memorisation programme in eight months. I received my Ijāzah and now teach beginners at home.", name: "Ahmed", context: "Hifz and Ijāzah, UAE" },
      { text: "I went from no Arabic to fluent conversation in six months, and gave a live presentation in Cairo.", name: "Sarah", context: "Arabic, United Kingdom" },
      { text: "Personal coaching and interactive lessons took me to confident Egyptian Ammiyya in three months.", name: "Yasmine", context: "Egyptian Ammiyya, Turkey" },
    ],
  },
  films: {
    title: "Watch Nile Center",
    lead: "Two short films from Nile Center’s own channel.",
    life: { title: "Life at Nile Center", note: "Inside the Nasr City centre, teaching since 1998" },
    start: { title: "Start learning Arabic and Qur’an", note: "A short introduction from Nile Center" },
    play: "Play film",
    source: "Plays from YouTube",
    close: "Close film",
  },
  faq: {
    title: "Questions people ask first",
    lead: "Short answers. For anything else, message an admissions advisor on WhatsApp.",
    items: [
      { q: "What happens in the free placement test?", a: "It takes about 30 minutes, online or on campus. A teacher checks your level and tells you where to start." },
      { q: "Can I try a lesson before I pay?", a: "Yes. Book a free trial lesson with a certified teacher, then decide." },
      { q: "When are classes held?", a: "There are morning, afternoon and evening groups, online and on campus." },
      { q: "Do you teach children?", a: "Yes. The Kids path covers Qur’an, Arabic and Islamic studies for ages 5 to 14." },
      { q: "Can I study from outside Egypt?", a: "Yes. Live online classes run worldwide, with recordings and materials to revise from." },
      { q: "Where are the campuses?", a: "Two branches in the 7th District of Nasr City, Cairo: 37 Abd Al-Shafy Mohammed and 6 Fadl ibn Rabea." },
    ],
  },
  cta: {
    title: "Start with a free trial lesson.",
    text: "Tell us what you want to learn. We reply with a time for your placement test and trial lesson.",
    trial: "Book a free trial lesson",
    whatsapp: "Message us on WhatsApp",
  },
  footer: {
    tagline: "Education for a brighter future, one learner at a time.",
    programmes: "Programmes",
    school: "School",
    contact: "Contact",
    about: "About us",
    faq: "Questions",
    verify: "Verify a certificate",
    privacy: "Privacy",
    terms: "Terms",
    staff: "Staff sign in",
    rights: "Nile Learning Center. All rights reserved.",
  },
};

export type LandingCopy = typeof en;

const ar: LandingCopy = {
  langName: "العربية",
  notice: "باب القبول مفتوح. اختبارات تحديد المستوى والحصص التجريبية مجانية.",
  where: "مدينة نصر، القاهرة · مباشر أونلاين حول العالم",
  nav: {
    programmes: "البرامج",
    start: "كيف تبدأ",
    modes: "أونلاين وحضوري",
    contact: "تواصل معنا",
    signIn: "تسجيل الدخول",
    menu: "القائمة",
    close: "إغلاق القائمة",
    language: "اللغة",
    skip: "تخطَّ إلى المحتوى",
  },
  hero: {
    eyebrow: "العربية والقرآن والدراسات الإسلامية منذ 1998",
    line1: "تعلّم بشغف.",
    line2: "وتفوّق",
    accent: "بامتياز.",
    lead: "معلمون معتمدون، وخطة مبنية على مستواك، وحصص مباشرة أونلاين أو في مقرّنا بمدينة نصر في القاهرة.",
    trial: "احجز حصة تجريبية مجانية",
    placement: "احجز اختبار تحديد المستوى",
    note: "يبدأ كل متعلم باختبار مجاني لتحديد المستوى مدته 30 دقيقة.",
    chipOnline: "مباشر أونلاين حول العالم",
    chipCampus: "فرعان في مدينة نصر",
    chipCertified: "معلمون معتمدون",
  },
  stats: [
    { value: "1998", label: "تأسس في القاهرة" },
    { value: "+120,000", label: "متعلم" },
    { value: "120", label: "جنسية" },
    { value: "150", label: "معلمًا" },
  ],
  programmes: {
    title: "البرامج",
    lead: "ثمانية مسارات بمعيار تعليم واحد. كل مسار يبدأ من مستواك.",
    all: "عرض كل البرامج",
    open: "اكتشف",
    items: [
      { slug: "quran", name: "القرآن الكريم", desc: "التلاوة للمبتدئين، والتجويد، والحفظ، والإجازة، والقراءات السبع والعشر.", meta: "من البداية حتى الإجازة" },
      { slug: "arabic", name: "اللغة العربية", desc: "الفصحى، والعامية المصرية، والمحادثة، والنحو، والخط العربي.", meta: "من A1 حتى المتقدم" },
      { slug: "islamic-studies", name: "الدراسات الإسلامية", desc: "العربية القرآنية وأسس الدراسات الإسلامية بإشراف معلم.", meta: "مجموعات مباشرة أسبوعية" },
      { slug: "kids", name: "الأطفال", desc: "مسارات في القرآن والعربية والدراسات الإسلامية مصممة للصغار.", meta: "من 5 إلى 14 سنة" },
      { slug: "turkish", name: "اللغة التركية", desc: "التركية الحديثة للدراسة والسفر والحياة اليومية.", meta: "من A1 حتى B2" },
      { slug: "english", name: "اللغة الإنجليزية", desc: "الإنجليزية العامة والأكاديمية في مجموعات صغيرة مركّزة.", meta: "كل المستويات" },
      { slug: "teacher-training", name: "إعداد المعلمين", desc: "طرق التدريس وإدارة الفصل والتقييم لمعلمي العربية والقرآن.", meta: "للمعلمين الممارسين" },
      { slug: "enterprise", name: "المؤسسات", desc: "برامج نصممها مع المدارس والشركات والمساجد والمجتمعات.", meta: "نصممها معكم" },
    ],
  },
  wisdom: {
    meaning: "العلم نور.",
    text: "حكمة عربية قديمة، وهي سبب وجود مركز النيل: أن يترك كل درس المتعلّم يرى أوضح قليلًا.",
  },
  teach: {
    title: "كيف نُعلّم",
    lead: "ثلاث عادات يشترك فيها كل فصل، من أول حروف الطفل حتى الإجازة.",
    items: [
      { title: "خطة على قدر مستواك", text: "كل متعلم، من المبتدئ تمامًا حتى طالب الإجازة، يحصل على خطة تبدأ من حيث وجده اختبار المستوى." },
      { title: "مباشر وتفاعلي", text: "معلمون حقيقيون وحوار حقيقي في مجموعات صباحية وظهرية ومسائية، مع تسجيلات للمراجعة." },
      { title: "تقدّم موثّق", text: "الحضور والدرجات وملاحظات المعلم في حساب واحد، لتعرف أنت وأسرتك موقعك دائمًا." },
    ],
  },
  start: {
    title: "كيف تبدأ",
    lead: "أربع خطوات نفسها لكل متعلم، مهما كان مستواه.",
    steps: [
      { title: "أخبرنا بهدفك", text: "أرسل استفسارًا قصيرًا، ويرد عليك مستشار القبول بالخيارات المناسبة." },
      { title: "اختبار مستوى مجاني", text: "ثلاثون دقيقة أونلاين أو في المقر، لتبدأ من مستواك بالضبط." },
      { title: "حصة تجريبية مجانية", text: "احضر حصة حقيقية مع معلم معتمد قبل أن تقرر أي شيء." },
      { title: "انضم إلى فصلك", text: "اختر مجموعة صباحية أو مسائية. خطتك وتقدمك في مكان واحد." },
    ],
  },
  modes: {
    title: "أونلاين أو حضوري",
    lead: "المعلمون أنفسهم والمعيار نفسه، أينما تعلّمت.",
    online: {
      title: "مباشر أونلاين",
      text: "حصص تفاعلية مباشرة مع دروس مسجلة على منصتك التعليمية.",
      points: ["انضم من أي مكان في العالم", "مجموعات صباحية وظهرية ومسائية", "التسجيلات والمواد مشمولة"],
      phoneLabel: "الدورات الأونلاين",
    },
    campus: {
      title: "حضوري في القاهرة",
      text: "فرعان في مدينة نصر بفصول هادئة واستوديوهات للخط العربي.",
      points: ["الفرع الأول: 37 شارع عبد الشافي محمد، الحي السابع", "الفرع الثاني: 6 شارع الفضل بن الربيع، الحي السابع", "اختبارات المستوى والحصص التجريبية في المقر"],
      phoneLabel: "الدورات الحضورية",
    },
  },
  quotes: {
    title: "بكلمات متعلمينا",
    items: [
      { text: "أرشدني معلميّ في برنامج الحفظ كاملًا خلال ثمانية أشهر. حصلت على الإجازة وأُدرّس المبتدئين الآن في بلدي.", name: "أحمد", context: "الحفظ والإجازة، الإمارات" },
      { text: "انتقلت من الصفر إلى محادثة طليقة بالعربية في ستة أشهر، وقدّمت عرضًا مباشرًا في القاهرة.", name: "سارة", context: "اللغة العربية، المملكة المتحدة" },
      { text: "بفضل التوجيه الشخصي والحصص التفاعلية أتقنت العامية المصرية في ثلاثة أشهر.", name: "ياسمين", context: "العامية المصرية، تركيا" },
    ],
  },
  films: {
    title: "شاهد مركز النيل",
    lead: "فيلمان قصيران من قناة مركز النيل.",
    life: { title: "الحياة في مركز النيل", note: "من داخل المركز في مدينة نصر، يعلّم منذ 1998" },
    start: { title: "ابدأ تعلّم العربية والقرآن", note: "مقدمة قصيرة من مركز النيل" },
    play: "تشغيل الفيلم",
    source: "يُعرض من يوتيوب",
    close: "إغلاق الفيلم",
  },
  faq: {
    title: "أسئلة يطرحها الناس أولًا",
    lead: "إجابات قصيرة. لأي سؤال آخر، راسل مستشار القبول على واتساب.",
    items: [
      { q: "ماذا يحدث في اختبار تحديد المستوى المجاني؟", a: "يستغرق نحو 30 دقيقة، أونلاين أو في المقر. يحدد المعلم مستواك ويخبرك من أين تبدأ." },
      { q: "هل يمكنني تجربة حصة قبل الدفع؟", a: "نعم. احجز حصة تجريبية مجانية مع معلم معتمد، ثم قرّر." },
      { q: "متى تُعقد الحصص؟", a: "توجد مجموعات صباحية وظهرية ومسائية، أونلاين وفي المقر." },
      { q: "هل تدرّسون الأطفال؟", a: "نعم. مسار الأطفال يشمل القرآن والعربية والدراسات الإسلامية من سن 5 إلى 14 سنة." },
      { q: "هل يمكنني الدراسة من خارج مصر؟", a: "نعم. الحصص المباشرة أونلاين متاحة حول العالم، مع تسجيلات ومواد للمراجعة." },
      { q: "أين يقع المقر؟", a: "فرعان في الحي السابع بمدينة نصر، القاهرة: 37 شارع عبد الشافي محمد، و6 شارع فضل بن ربيع." },
    ],
  },
  cta: {
    title: "ابدأ بحصة تجريبية مجانية.",
    text: "أخبرنا بما تريد تعلّمه، ونرد عليك بموعد اختبار المستوى والحصة التجريبية.",
    trial: "احجز حصة تجريبية مجانية",
    whatsapp: "راسلنا على واتساب",
  },
  footer: {
    tagline: "تعليم من أجل مستقبل أفضل، متعلمًا بعد متعلم.",
    programmes: "البرامج",
    school: "المركز",
    contact: "تواصل",
    about: "من نحن",
    faq: "الأسئلة الشائعة",
    verify: "التحقق من شهادة",
    privacy: "الخصوصية",
    terms: "الشروط",
    staff: "دخول الموظفين",
    rights: "مركز النيل التعليمي. جميع الحقوق محفوظة.",
  },
};

const tr: LandingCopy = {
  langName: "Türkçe",
  notice: "Kayıtlar açık. Seviye sınavları ve deneme dersleri ücretsiz.",
  where: "Nasr City, Kahire · Dünya genelinde canlı çevrim içi",
  nav: {
    programmes: "Programlar",
    start: "Nasıl başlanır",
    modes: "Çevrim içi ve kampüs",
    contact: "İletişim",
    signIn: "Giriş yap",
    menu: "Menü",
    close: "Menüyü kapat",
    language: "Dil",
    skip: "İçeriğe geç",
  },
  hero: {
    eyebrow: "1998’den beri Arapça, Kur’an ve İslami ilimler",
    line1: "Tutkuyla öğrenin.",
    line2: "Farkla",
    accent: "başarın.",
    lead: "Sertifikalı öğretmenler, seviyenize göre hazırlanan bir plan ve çevrim içi ya da Kahire Nasr City kampüsünde canlı dersler.",
    trial: "Ücretsiz deneme dersi alın",
    placement: "Seviye sınavı planlayın",
    note: "Her öğrenci 30 dakikalık ücretsiz bir seviye sınavıyla başlar.",
    chipOnline: "Dünya genelinde canlı",
    chipCampus: "Nasr City’de iki kampüs",
    chipCertified: "Sertifikalı öğretmenler",
  },
  stats: [
    { value: "1998", label: "Kahire’de kuruldu" },
    { value: "120.000+", label: "Öğrenci" },
    { value: "120", label: "Uyruk" },
    { value: "150", label: "Öğretmen" },
  ],
  programmes: {
    title: "Programlar",
    lead: "Sekiz yol, tek bir öğretim standardı. Her yol sizin seviyenizden başlar.",
    all: "Tüm programları görün",
    open: "İncele",
    items: [
      { slug: "quran", name: "Kur’an", desc: "Başlangıç tilaveti, tecvid, hıfz, icazet, yedi ve on kıraat.", meta: "Başlangıçtan icazete" },
      { slug: "arabic", name: "Arapça", desc: "Modern Standart Arapça, Mısır lehçesi, konuşma, dil bilgisi ve hat.", meta: "A1’den ileri seviyeye" },
      { slug: "islamic-studies", name: "İslami ilimler", desc: "Kur’an Arapçası ve rehberli İslami ilimler temelleri.", meta: "Haftalık canlı gruplar" },
      { slug: "kids", name: "Çocuklar", desc: "Küçük öğrenciler için Kur’an, Arapça ve İslami ilimler yolları.", meta: "5-14 yaş" },
      { slug: "turkish", name: "Türkçe", desc: "Eğitim, seyahat ve günlük yaşam için modern Türkçe.", meta: "A1’den B2’ye" },
      { slug: "english", name: "İngilizce", desc: "Küçük ve odaklı gruplarda genel ve akademik İngilizce.", meta: "Tüm seviyeler" },
      { slug: "teacher-training", name: "Öğretmen eğitimi", desc: "Arapça ve Kur’an öğretmenleri için yöntem, sınıf yönetimi ve ölçme.", meta: "Görevdeki öğretmenler için" },
      { slug: "enterprise", name: "Kurumlar", desc: "Okullar, şirketler, camiler ve topluluklarla birlikte tasarlanan programlar.", meta: "Sizinle birlikte" },
    ],
  },
  wisdom: {
    meaning: "İlim nurdur.",
    text: "Eski bir Arap sözü ve Nil Merkezi’nin var olma nedeni: her ders, öğrenciyi biraz daha net görür hâlde bırakmalı.",
  },
  teach: {
    title: "Nasıl öğretiyoruz",
    lead: "Bir çocuğun ilk harflerinden icazete kadar her sınıfın paylaştığı üç alışkanlık.",
    items: [
      { title: "Seviyenize göre bir plan", text: "Mutlak başlangıçtan icazet adayına kadar her öğrenci, seviye sınavının bulduğu yerden başlayan bir plan alır." },
      { title: "Canlı ve etkileşimli", text: "Sabah, öğleden sonra ve akşam gruplarında gerçek öğretmenler ve gerçek sohbet; tekrar için kayıtlar da var." },
      { title: "Kayıtlı ilerleme", text: "Devam, notlar ve öğretmen geri bildirimi tek hesapta; siz ve aileniz her zaman nerede olduğunuzu bilirsiniz." },
    ],
  },
  start: {
    title: "Nasıl başlarsınız",
    lead: "Seviyesi ne olursa olsun her öğrenci için aynı dört adım.",
    steps: [
      { title: "Hedefinizi anlatın", text: "Kısa bir başvuru gönderin. Kabul danışmanı size uygun seçeneklerle döner." },
      { title: "Ücretsiz seviye sınavı", text: "Çevrim içi veya kampüste otuz dakika; tam seviyenizden başlarsınız." },
      { title: "Ücretsiz deneme dersi", text: "Karar vermeden önce sertifikalı bir öğretmenle gerçek bir derse katılın." },
      { title: "Sınıfınıza katılın", text: "Sabah, öğleden sonra veya akşam grubunu seçin. Planınız ve ilerlemeniz tek yerde." },
    ],
  },
  modes: {
    title: "Çevrim içi veya kampüste",
    lead: "Nerede öğrenirseniz öğrenin, aynı öğretmenler ve aynı standart.",
    online: {
      title: "Canlı çevrim içi",
      text: "Öğrenme platformunuzda kayıtlı derslerle birlikte etkileşimli canlı dersler.",
      points: ["Dünyanın her yerinden katılın", "Sabah, öğleden sonra ve akşam grupları", "Kayıtlar ve materyaller dahil"],
      phoneLabel: "Çevrim içi kurslar",
    },
    campus: {
      title: "Kahire’de kampüste",
      text: "Nasr City’de sakin sınıfları ve hat atölyeleri olan iki kampüs.",
      points: ["1. Şube: 37 Abd Al-Shafy Mohammed, 7. Bölge", "2. Şube: 6 Fadl ibn Rabea, 7. Bölge", "Seviye sınavı ve deneme dersi kampüste"],
      phoneLabel: "Yüz yüze kurslar",
    },
  },
  quotes: {
    title: "Öğrencilerimizin sözleriyle",
    items: [
      { text: "Öğretmenlerim sekiz ayda tüm hıfz programında bana rehberlik etti. İcazetimi aldım ve şimdi ülkemde başlangıç sınıflarına ders veriyorum.", name: "Ahmed", context: "Hıfz ve icazet, BAE" },
      { text: "Altı ayda sıfırdan akıcı Arapça konuşmaya geçtim ve Kahire’de canlı bir sunum yaptım.", name: "Sarah", context: "Arapça, Birleşik Krallık" },
      { text: "Kişisel rehberlik ve etkileşimli derslerle üç ayda Mısır lehçesinde kendime güvendim.", name: "Yasmine", context: "Mısır lehçesi, Türkiye" },
    ],
  },
  films: {
    title: "Nile Center'ı izleyin",
    lead: "Nile Center'ın kendi kanalından iki kısa film.",
    life: { title: "Nile Center'da yaşam", note: "1998'den beri Nasr City'deki merkezin içinden" },
    start: { title: "Arapça ve Kur’an öğrenmeye başlayın", note: "Nile Center'dan kısa bir tanıtım" },
    play: "Filmi oynat",
    source: "YouTube'dan oynatılır",
    close: "Filmi kapat",
  },
  faq: {
    title: "İlk sorulan sorular",
    lead: "Kısa cevaplar. Başka bir sorunuz için WhatsApp'tan kabul danışmanına yazın.",
    items: [
      { q: "Ücretsiz seviye sınavında ne olur?", a: "Çevrim içi veya kampüste yaklaşık 30 dakika sürer. Öğretmen seviyenizi belirler ve nereden başlayacağınızı söyler." },
      { q: "Ödeme yapmadan önce bir ders deneyebilir miyim?", a: "Evet. Sertifikalı bir öğretmenle ücretsiz deneme dersi alın, sonra karar verin." },
      { q: "Dersler ne zaman yapılıyor?", a: "Çevrim içi ve kampüste sabah, öğleden sonra ve akşam grupları vardır." },
      { q: "Çocuklara ders veriyor musunuz?", a: "Evet. Çocuk programı 5 ile 14 yaş arası için Kur’an, Arapça ve İslami ilimleri kapsar." },
      { q: "Mısır dışından ders alabilir miyim?", a: "Evet. Canlı çevrim içi dersler dünyanın her yerinden alınabilir; kayıtlar ve materyaller dahildir." },
      { q: "Kampüsler nerede?", a: "Kahire, Nasr City 7. Bölge'de iki şube: 37 Abd Al-Shafy Mohammed ve 6 Fadl ibn Rabea." },
    ],
  },
  cta: {
    title: "Ücretsiz bir deneme dersiyle başlayın.",
    text: "Ne öğrenmek istediğinizi yazın. Seviye sınavınız ve deneme dersiniz için size bir zaman önerelim.",
    trial: "Ücretsiz deneme dersi alın",
    whatsapp: "WhatsApp’tan yazın",
  },
  footer: {
    tagline: "Daha parlak bir gelecek için eğitim, her seferinde bir öğrenci.",
    programmes: "Programlar",
    school: "Merkez",
    contact: "İletişim",
    about: "Hakkımızda",
    faq: "Sorular",
    verify: "Sertifika doğrula",
    privacy: "Gizlilik",
    terms: "Koşullar",
    staff: "Personel girişi",
    rights: "Nil Eğitim Merkezi. Tüm hakları saklıdır.",
  },
};

const zh: LandingCopy = {
  langName: "中文",
  notice: "招生进行中。分级测试和试听课免费。",
  where: "开罗纳斯尔城 · 全球线上直播",
  nav: {
    programmes: "课程项目",
    start: "如何开始",
    modes: "线上与校区",
    contact: "联系我们",
    signIn: "登录",
    menu: "菜单",
    close: "关闭菜单",
    language: "语言",
    skip: "跳到主要内容"
  },
  hero: {
    eyebrow: "自 1998 年起教授阿拉伯语、《古兰经》和伊斯兰研究",
    line1: "怀着热情学习。",
    line2: "以卓越",
    accent: "取得成功。",
    lead: "认证教师、根据你的水平制定的学习计划，以及线上直播或开罗纳斯尔城校区的面授课程。",
    trial: "预约免费试听课",
    placement: "预约分级测试",
    note: "每位学员都从 30 分钟的免费分级测试开始。",
    chipOnline: "全球线上直播",
    chipCampus: "纳斯尔城两个校区",
    chipCertified: "认证教师"
  },
  stats: [
    {
      value: "1998",
      label: "创立于开罗"
    },
    {
      value: "120,000+",
      label: "培养的学员"
    },
    {
      value: "120",
      label: "个国籍"
    },
    {
      value: "150",
      label: "名教师"
    }
  ],
  programmes: {
    title: "课程项目",
    lead: "八条学习路径，同一教学标准。每条路径都从你的水平开始。",
    all: "查看所有课程项目",
    open: "了解更多",
    items: [
      {
        slug: "quran",
        name: "《古兰经》",
        desc: "初学者诵读、泰吉威德（诵读规则）、背诵、伊贾宰（传授资格）、七种和十种诵读法。",
        meta: "从入门到伊贾宰"
      },
      {
        slug: "arabic",
        name: "阿拉伯语",
        desc: "现代标准阿拉伯语、埃及方言、会话、语法和书法。",
        meta: "A1 到高级"
      },
      {
        slug: "islamic-studies",
        name: "伊斯兰研究",
        desc: "《古兰经》阿拉伯语以及有教师指导的伊斯兰研究基础。",
        meta: "每周直播小组"
      },
      {
        slug: "kids",
        name: "少儿",
        desc: "专为少年学员设计的《古兰经》、阿拉伯语和伊斯兰研究课程。",
        meta: "5 至 14 岁"
      },
      {
        slug: "turkish",
        name: "土耳其语",
        desc: "用于学习、旅行和日常生活的现代土耳其语。",
        meta: "A1 到 B2"
      },
      {
        slug: "english",
        name: "英语",
        desc: "小而专注的通用英语和学术英语课程。",
        meta: "所有级别"
      },
      {
        slug: "teacher-training",
        name: "教师培训",
        desc: "面向阿拉伯语和《古兰经》教师的教学方法、课堂技巧和评估。",
        meta: "面向在职教师"
      },
      {
        slug: "enterprise",
        name: "机构",
        desc: "与学校、企业、清真寺和社区共同设计的课程。",
        meta: "与你共同打造"
      }
    ]
  },
  wisdom: {
    meaning: "知识就是光。",
    text: "一句古老的阿拉伯谚语，也是尼罗中心存在的理由：每一堂课都应让学员看得更清楚一点。"
  },
  teach: {
    title: "我们的教学方式",
    lead: "每个班级都坚持的三个习惯，从孩子的第一个字母到伊贾宰。",
    items: [
      {
        title: "为你的水平制定的计划",
        text: "每位学员，从零基础到伊贾宰候选人，都会获得一份从分级测试结果出发的计划。"
      },
      {
        title: "直播互动",
        text: "真正的教师、真正的交流，分为上午、下午和晚上小组，并提供录像供复习。"
      },
      {
        title: "学习进度有记录",
        text: "考勤、成绩和教师反馈都保存在同一个账户中，你和家人随时了解学习情况。"
      }
    ]
  },
  start: {
    title: "如何开始",
    lead: "无论什么水平，每位学员都经历同样的四个步骤。",
    steps: [
      {
        title: "告诉我们你的目标",
        text: "发送一条简短咨询。招生顾问会回复合适的选择。"
      },
      {
        title: "免费分级测试",
        text: "三十分钟，线上或在校区进行，让你从最合适的水平开始。"
      },
      {
        title: "免费试听课",
        text: "在做任何决定之前，先与认证教师上一节真正的课。"
      },
      {
        title: "加入你的班级",
        text: "选择上午、下午或晚上的小组。你的计划和进度都在一个地方。"
      }
    ]
  },
  modes: {
    title: "线上或校区",
    lead: "无论在哪里学习，都是同样的教师和同样的标准。",
    online: {
      title: "线上直播",
      text: "互动直播课程，学习平台上提供课程录像。",
      points: [
        "在世界任何地方加入",
        "上午、下午和晚上小组",
        "包含录像和学习资料"
      ],
      phoneLabel: "线上课程"
    },
    campus: {
      title: "开罗校区",
      text: "纳斯尔城的两个校区，配有安静的教室和书法工作室。",
      points: [
        "第一校区：第七区 Abd Al-Shafy Mohammed 街 37 号",
        "第二校区：第七区 Fadl ibn Rabea 街 6 号",
        "分级测试和试听课可在校区进行"
      ],
      phoneLabel: "校区课程"
    }
  },
  quotes: {
    title: "学员心声",
    items: [
      {
        text: "我的老师在八个月内带我完成了全部背诵课程。我获得了伊贾宰，现在在家乡教初学者。",
        name: "艾哈迈德",
        context: "背诵与伊贾宰，阿联酋"
      },
      {
        text: "我在六个月内从零基础达到流利会话，还在开罗做了一次现场演讲。",
        name: "莎拉",
        context: "阿拉伯语，英国"
      },
      {
        text: "一对一辅导和互动课程让我在三个月内自信地掌握了埃及方言。",
        name: "雅斯敏",
        context: "埃及方言，土耳其"
      }
    ]
  },
  films: {
    title: "观看尼罗中心",
    lead: "来自尼罗中心官方频道的两部短片。",
    life: {
      title: "尼罗中心的日常",
      note: "走进纳斯尔城校区，自 1998 年起从事教学"
    },
    start: {
      title: "开始学习阿拉伯语和《古兰经》",
      note: "尼罗中心简短介绍"
    },
    play: "播放影片",
    source: "在 YouTube 播放",
    close: "关闭影片"
  },
  faq: {
    title: "大家最先问的问题",
    lead: "简短回答。其他问题请通过 WhatsApp 联系招生顾问。",
    items: [
      {
        q: "免费分级测试包括什么？",
        a: "大约需要 30 分钟，线上或在校区进行。教师会评估你的水平，并告诉你从哪里开始。"
      },
      {
        q: "付款前可以先试听吗？",
        a: "可以。先预约一节由认证教师授课的免费试听课，再做决定。"
      },
      {
        q: "什么时候上课？",
        a: "有上午、下午和晚上的小组，线上和校区都有。"
      },
      {
        q: "你们教孩子吗？",
        a: "教。少儿课程涵盖 5 至 14 岁儿童的《古兰经》、阿拉伯语和伊斯兰研究。"
      },
      {
        q: "我可以在埃及以外学习吗？",
        a: "可以。线上直播课程面向全球，并提供录像和资料供复习。"
      },
      {
        q: "校区在哪里？",
        a: "开罗纳斯尔城第七区的两个校区：Abd Al-Shafy Mohammed 街 37 号和 Fadl ibn Rabea 街 6 号。"
      }
    ]
  },
  cta: {
    title: "从免费试听课开始。",
    text: "告诉我们你想学什么。我们会回复你分级测试和试听课的时间。",
    trial: "预约免费试听课",
    whatsapp: "通过 WhatsApp 联系我们"
  },
  footer: {
    tagline: "教育成就更光明的未来，一次成就一位学员。",
    programmes: "课程项目",
    school: "学校",
    contact: "联系方式",
    about: "关于我们",
    faq: "常见问题",
    verify: "验证证书",
    privacy: "隐私",
    terms: "条款",
    staff: "员工登录",
    rights: "尼罗学习中心。保留所有权利。"
  }
};

const ru: LandingCopy = {
  langName: "Русский",
  notice: "Идёт набор. Тест на уровень и пробный урок бесплатны.",
  where: "Наср-Сити, Каир · Онлайн по всему миру",
  nav: {
    programmes: "Программы",
    start: "Как начать",
    modes: "Онлайн и очно",
    contact: "Контакты",
    signIn: "Войти",
    menu: "Меню",
    close: "Закрыть меню",
    language: "Язык",
    skip: "Перейти к содержанию"
  },
  hero: {
    eyebrow: "Арабский язык, Коран и исламские науки с 1998 года",
    line1: "Учитесь с увлечением.",
    line2: "Добивайтесь",
    accent: "отличных результатов.",
    lead: "Сертифицированные преподаватели, план под ваш уровень и занятия онлайн или очно в Наср-Сити, Каир.",
    trial: "Записаться на бесплатный пробный урок",
    placement: "Записаться на тест на уровень",
    note: "Каждый ученик начинает с бесплатного 30-минутного теста на уровень.",
    chipOnline: "Онлайн по всему миру",
    chipCampus: "Два филиала в Наср-Сити",
    chipCertified: "Сертифицированные преподаватели"
  },
  stats: [
    {
      value: "1998",
      label: "Основан в Каире"
    },
    {
      value: "120 000+",
      label: "Выпускников"
    },
    {
      value: "120",
      label: "Национальностей"
    },
    {
      value: "150",
      label: "Преподавателей"
    }
  ],
  programmes: {
    title: "Программы",
    lead: "Восемь направлений, единый стандарт преподавания. Каждое начинается с вашего уровня.",
    all: "Все программы",
    open: "Подробнее",
    items: [
      {
        slug: "quran",
        name: "Коран",
        desc: "Чтение для начинающих, таджвид, хифз, иджаза, семь и десять кираатов.",
        meta: "От начального уровня до иджазы"
      },
      {
        slug: "arabic",
        name: "Арабский язык",
        desc: "Литературный арабский, египетский диалект, разговорная практика, грамматика и каллиграфия.",
        meta: "От A1 до продвинутого"
      },
      {
        slug: "islamic-studies",
        name: "Исламские науки",
        desc: "Коранический арабский и основы исламских наук под руководством преподавателя.",
        meta: "Еженедельные онлайн-группы"
      },
      {
        slug: "kids",
        name: "Детям",
        desc: "Программы по Корану, арабскому языку и исламским наукам для юных учеников.",
        meta: "От 5 до 14 лет"
      },
      {
        slug: "turkish",
        name: "Турецкий язык",
        desc: "Современный турецкий для учёбы, путешествий и повседневной жизни.",
        meta: "От A1 до B2"
      },
      {
        slug: "english",
        name: "Английский язык",
        desc: "Общий и академический английский в небольших группах.",
        meta: "Все уровни"
      },
      {
        slug: "teacher-training",
        name: "Подготовка преподавателей",
        desc: "Методика, мастерство ведения урока и оценивание для преподавателей арабского и Корана.",
        meta: "Для практикующих преподавателей"
      },
      {
        slug: "enterprise",
        name: "Организациям",
        desc: "Программы, созданные вместе со школами, компаниями, мечетями и общинами.",
        meta: "Создаём вместе с вами"
      }
    ]
  },
  wisdom: {
    meaning: "Знание — это свет.",
    text: "Старинная арабская пословица и смысл существования Nile Center: после каждого урока ученик должен видеть немного яснее."
  },
  teach: {
    title: "Как мы учим",
    lead: "Три принципа каждого занятия — от первых букв ребёнка до иджазы.",
    items: [
      {
        title: "План под ваш уровень",
        text: "Каждый ученик, от новичка до кандидата на иджазу, получает план, который начинается с результата теста на уровень."
      },
      {
        title: "Живые и интерактивные занятия",
        text: "Настоящие преподаватели, живое общение, утренние, дневные и вечерние группы и записи для повторения."
      },
      {
        title: "Прогресс под контролем",
        text: "Посещаемость, оценки и отзывы преподавателей хранятся в одном аккаунте, и вы с семьёй всегда знаете, на каком вы этапе."
      }
    ]
  },
  start: {
    title: "Как начать",
    lead: "Четыре одинаковых шага для каждого ученика, независимо от уровня.",
    steps: [
      {
        title: "Расскажите о своей цели",
        text: "Отправьте короткую заявку. Консультант по приёму ответит с подходящими вариантами."
      },
      {
        title: "Бесплатный тест на уровень",
        text: "Тридцать минут онлайн или очно, чтобы вы начали точно со своего уровня."
      },
      {
        title: "Бесплатный пробный урок",
        text: "Пройдите настоящий урок с сертифицированным преподавателем, прежде чем принимать решение."
      },
      {
        title: "Присоединяйтесь к группе",
        text: "Выберите утреннюю, дневную или вечернюю группу. Ваш план и прогресс — в одном месте."
      }
    ]
  },
  modes: {
    title: "Онлайн или очно",
    lead: "Те же преподаватели и тот же стандарт, где бы вы ни учились.",
    online: {
      title: "Онлайн",
      text: "Интерактивные живые занятия и записи уроков на вашей учебной платформе.",
      points: [
        "Подключайтесь из любой точки мира",
        "Утренние, дневные и вечерние группы",
        "Записи и материалы включены"
      ],
      phoneLabel: "Онлайн-курсы"
    },
    campus: {
      title: "Очно в Каире",
      text: "Два филиала в Наср-Сити с тихими аудиториями и студиями каллиграфии.",
      points: [
        "Филиал 1: ул. Абд аль-Шафи Мохаммед, 37, 7-й район",
        "Филиал 2: ул. Фадль ибн Рабиа, 6, 7-й район",
        "Тесты на уровень и пробные уроки на месте"
      ],
      phoneLabel: "Очные курсы"
    }
  },
  quotes: {
    title: "Отзывы наших учеников",
    items: [
      {
        text: "Преподаватели провели меня через полную программу заучивания Корана за восемь месяцев. Я получил иджазу и теперь учу начинающих у себя на родине.",
        name: "Ахмед",
        context: "Хифз и иджаза, ОАЭ"
      },
      {
        text: "За шесть месяцев я прошла путь от нуля до свободного общения на арабском и выступила с презентацией в Каире.",
        name: "Сара",
        context: "Арабский язык, Великобритания"
      },
      {
        text: "Индивидуальные занятия и интерактивные уроки за три месяца помогли мне уверенно заговорить на египетском диалекте.",
        name: "Ясмин",
        context: "Египетский диалект, Турция"
      }
    ]
  },
  films: {
    title: "Смотрите Nile Center",
    lead: "Два коротких фильма с собственного канала Nile Center.",
    life: {
      title: "Жизнь в Nile Center",
      note: "Внутри центра в Наср-Сити, обучаем с 1998 года"
    },
    start: {
      title: "Начните учить арабский и Коран",
      note: "Короткое знакомство с Nile Center"
    },
    play: "Смотреть фильм",
    source: "Воспроизводится с YouTube",
    close: "Закрыть фильм"
  },
  faq: {
    title: "Что спрашивают в первую очередь",
    lead: "Короткие ответы. По остальным вопросам напишите консультанту по приёму в WhatsApp.",
    items: [
      {
        q: "Как проходит бесплатный тест на уровень?",
        a: "Он занимает около 30 минут, онлайн или очно. Преподаватель определяет ваш уровень и говорит, с чего начать."
      },
      {
        q: "Можно ли попробовать урок до оплаты?",
        a: "Да. Запишитесь на бесплатный пробный урок с сертифицированным преподавателем, а потом решайте."
      },
      {
        q: "Когда проходят занятия?",
        a: "Есть утренние, дневные и вечерние группы, онлайн и очно."
      },
      {
        q: "Вы учите детей?",
        a: "Да. Детская программа охватывает Коран, арабский язык и исламские науки для детей от 5 до 14 лет."
      },
      {
        q: "Можно ли учиться не из Египта?",
        a: "Да. Онлайн-занятия доступны по всему миру, с записями и материалами для повторения."
      },
      {
        q: "Где находятся филиалы?",
        a: "Два филиала в 7-м районе Наср-Сити, Каир: ул. Абд аль-Шафи Мохаммед, 37, и ул. Фадль ибн Рабиа, 6."
      }
    ]
  },
  cta: {
    title: "Начните с бесплатного пробного урока.",
    text: "Расскажите, что вы хотите изучать. Мы предложим время для теста на уровень и пробного урока.",
    trial: "Записаться на бесплатный пробный урок",
    whatsapp: "Написать нам в WhatsApp"
  },
  footer: {
    tagline: "Образование для светлого будущего — для каждого ученика.",
    programmes: "Программы",
    school: "Школа",
    contact: "Контакты",
    about: "О нас",
    faq: "Вопросы",
    verify: "Проверить сертификат",
    privacy: "Конфиденциальность",
    terms: "Условия",
    staff: "Вход для сотрудников",
    rights: "Nile Learning Center. Все права защищены."
  }
};

const ur: LandingCopy = {
  langName: "اردو",
  notice: "داخلے جاری ہیں۔ لیول ٹیسٹ اور آزمائشی اسباق مفت ہیں۔",
  where: "نصر سٹی، قاہرہ · دنیا بھر میں براہِ راست آن لائن",
  nav: {
    programmes: "پروگرامز",
    start: "آغاز کیسے کریں",
    modes: "آن لائن اور کیمپس",
    contact: "رابطہ",
    signIn: "سائن ان",
    menu: "مینو",
    close: "مینو بند کریں",
    language: "زبان",
    skip: "مواد پر جائیں"
  },
  hero: {
    eyebrow: "1998 سے عربی، قرآن اور اسلامی علوم کی تعلیم",
    line1: "شوق سے سیکھیں۔",
    line2: "اور امتیاز کے ساتھ",
    accent: "کامیاب ہوں۔",
    lead: "مستند اساتذہ، آپ کی سطح کے مطابق منصوبہ، اور براہِ راست آن لائن یا نصر سٹی، قاہرہ کے کیمپس میں کلاسیں۔",
    trial: "مفت آزمائشی سبق بک کریں",
    placement: "لیول ٹیسٹ بک کریں",
    note: "ہر طالب علم 30 منٹ کے مفت لیول ٹیسٹ سے آغاز کرتا ہے۔",
    chipOnline: "دنیا بھر میں براہِ راست آن لائن",
    chipCampus: "نصر سٹی میں دو کیمپس",
    chipCertified: "مستند اساتذہ"
  },
  stats: [
    {
      value: "1998",
      label: "قاہرہ میں قیام"
    },
    {
      value: "+120,000",
      label: "فارغ التحصیل طلبہ"
    },
    {
      value: "120",
      label: "قومیتیں"
    },
    {
      value: "150",
      label: "اساتذہ"
    }
  ],
  programmes: {
    title: "پروگرامز",
    lead: "آٹھ راستے، تدریس کا ایک معیار۔ ہر راستہ آپ کی سطح سے شروع ہوتا ہے۔",
    all: "تمام پروگرامز دیکھیں",
    open: "مزید جانیں",
    items: [
      {
        slug: "quran",
        name: "قرآن",
        desc: "مبتدیوں کے لیے تلاوت، تجوید، حفظ، اجازہ، اور سات اور دس قراءات۔",
        meta: "ابتدا سے اجازہ تک"
      },
      {
        slug: "arabic",
        name: "عربی",
        desc: "فصیح عربی، مصری عامیہ، گفتگو، قواعد اور خطاطی۔",
        meta: "A1 سے اعلیٰ سطح تک"
      },
      {
        slug: "islamic-studies",
        name: "اسلامی علوم",
        desc: "قرآنی عربی اور استاد کی رہنمائی میں اسلامی علوم کی بنیادیں۔",
        meta: "ہفتہ وار براہِ راست گروپس"
      },
      {
        slug: "kids",
        name: "بچے",
        desc: "کم عمر طلبہ کے لیے قرآن، عربی اور اسلامی علوم کے راستے۔",
        meta: "5 سے 14 سال"
      },
      {
        slug: "turkish",
        name: "ترکی",
        desc: "تعلیم، سفر اور روزمرہ زندگی کے لیے جدید ترکی زبان۔",
        meta: "A1 سے B2 تک"
      },
      {
        slug: "english",
        name: "انگریزی",
        desc: "چھوٹے اور مرکوز گروپس میں عمومی اور تعلیمی انگریزی۔",
        meta: "تمام سطحیں"
      },
      {
        slug: "teacher-training",
        name: "اساتذہ کی تربیت",
        desc: "عربی اور قرآن کے اساتذہ کے لیے طریقۂ تدریس، کلاس روم کی مہارت اور جانچ۔",
        meta: "کام کرنے والے اساتذہ کے لیے"
      },
      {
        slug: "enterprise",
        name: "ادارے",
        desc: "اسکولوں، کمپنیوں، مساجد اور برادریوں کے ساتھ مل کر بنائے گئے پروگرامز۔",
        meta: "آپ کے ساتھ مل کر"
      }
    ]
  },
  wisdom: {
    meaning: "علم روشنی ہے۔",
    text: "ایک پرانی عربی کہاوت، اور نائل سینٹر کے وجود کی وجہ: ہر سبق کے بعد طالب علم کو تھوڑا اور واضح دکھائی دے۔"
  },
  teach: {
    title: "ہم کیسے پڑھاتے ہیں",
    lead: "تین عادتیں جو ہر کلاس میں ہیں، بچے کے پہلے حروف سے اجازہ تک۔",
    items: [
      {
        title: "آپ کی سطح کے مطابق منصوبہ",
        text: "ہر طالب علم، بالکل نئے سے لے کر اجازہ کے امیدوار تک، کو ایسا منصوبہ ملتا ہے جو لیول ٹیسٹ کے نتیجے سے شروع ہوتا ہے۔"
      },
      {
        title: "براہِ راست اور تعاملی",
        text: "حقیقی اساتذہ، حقیقی گفتگو، صبح، دوپہر اور شام کے گروپس میں، دہرانے کے لیے ریکارڈنگز کے ساتھ۔"
      },
      {
        title: "پیش رفت کا ریکارڈ",
        text: "حاضری، گریڈز اور اساتذہ کی رائے ایک ہی اکاؤنٹ میں رہتی ہے، تاکہ آپ اور آپ کا خاندان ہمیشہ جانیں کہ آپ کہاں ہیں۔"
      }
    ]
  },
  start: {
    title: "آغاز کیسے کریں",
    lead: "ہر طالب علم کے لیے ایک جیسے چار قدم، سطح کوئی بھی ہو۔",
    steps: [
      {
        title: "اپنا مقصد بتائیں",
        text: "مختصر پیغام بھیجیں۔ داخلہ مشیر مناسب اختیارات کے ساتھ جواب دیں گے۔"
      },
      {
        title: "مفت لیول ٹیسٹ",
        text: "تیس منٹ، آن لائن یا کیمپس میں، تاکہ آپ بالکل اپنی سطح سے آغاز کریں۔"
      },
      {
        title: "مفت آزمائشی سبق",
        text: "کوئی فیصلہ کرنے سے پہلے مستند استاد کے ساتھ ایک حقیقی سبق لیں۔"
      },
      {
        title: "اپنی کلاس میں شامل ہوں",
        text: "صبح، دوپہر یا شام کا گروپ منتخب کریں۔ آپ کا منصوبہ اور پیش رفت ایک جگہ رہتی ہے۔"
      }
    ]
  },
  modes: {
    title: "آن لائن یا کیمپس میں",
    lead: "آپ جہاں بھی پڑھیں، وہی اساتذہ اور وہی معیار۔",
    online: {
      title: "براہِ راست آن لائن",
      text: "آپ کے تعلیمی پلیٹ فارم پر ریکارڈ شدہ اسباق کے ساتھ تعاملی براہِ راست کلاسیں۔",
      points: [
        "دنیا میں کہیں سے بھی شامل ہوں",
        "صبح، دوپہر اور شام کے گروپس",
        "ریکارڈنگز اور مواد شامل"
      ],
      phoneLabel: "آن لائن کورسز"
    },
    campus: {
      title: "قاہرہ میں کیمپس",
      text: "نصر سٹی میں دو کیمپس، پُرسکون کلاس رومز اور خطاطی اسٹوڈیوز کے ساتھ۔",
      points: [
        "شاخ 1: 37 عبد الشافی محمد، ساتواں ضلع",
        "شاخ 2: 6 فضل بن ربیع، ساتواں ضلع",
        "لیول ٹیسٹ اور آزمائشی اسباق کیمپس میں"
      ],
      phoneLabel: "کیمپس کورسز"
    }
  },
  quotes: {
    title: "ہمارے طلبہ کی زبانی",
    items: [
      {
        text: "میرے اساتذہ نے آٹھ مہینوں میں مکمل حفظ کا پروگرام کروایا۔ مجھے اجازہ ملا اور اب میں اپنے وطن میں مبتدیوں کو پڑھاتا ہوں۔",
        name: "احمد",
        context: "حفظ اور اجازہ، متحدہ عرب امارات"
      },
      {
        text: "میں چھ مہینوں میں بالکل صفر سے روانی سے عربی بولنے لگی، اور قاہرہ میں براہِ راست پریزنٹیشن دی۔",
        name: "سارہ",
        context: "عربی، برطانیہ"
      },
      {
        text: "ذاتی رہنمائی اور تعاملی اسباق نے تین مہینوں میں مجھے اعتماد سے مصری عامیہ بولنا سکھا دیا۔",
        name: "یاسمین",
        context: "مصری عامیہ، ترکی"
      }
    ]
  },
  films: {
    title: "نائل سینٹر دیکھیں",
    lead: "نائل سینٹر کے اپنے چینل سے دو مختصر فلمیں۔",
    life: {
      title: "نائل سینٹر کی زندگی",
      note: "نصر سٹی سینٹر کے اندر، 1998 سے تدریس"
    },
    start: {
      title: "عربی اور قرآن سیکھنا شروع کریں",
      note: "نائل سینٹر کا مختصر تعارف"
    },
    play: "فلم چلائیں",
    source: "یوٹیوب سے چلتی ہے",
    close: "فلم بند کریں"
  },
  faq: {
    title: "لوگ پہلے کیا پوچھتے ہیں",
    lead: "مختصر جوابات۔ کسی اور سوال کے لیے واٹس ایپ پر داخلہ مشیر کو پیغام بھیجیں۔",
    items: [
      {
        q: "مفت لیول ٹیسٹ میں کیا ہوتا ہے؟",
        a: "یہ تقریباً 30 منٹ کا ہوتا ہے، آن لائن یا کیمپس میں۔ استاد آپ کی سطح جانچ کر بتاتا ہے کہ کہاں سے آغاز کریں۔"
      },
      {
        q: "کیا میں ادائیگی سے پہلے ایک سبق آزما سکتا ہوں؟",
        a: "جی ہاں۔ مستند استاد کے ساتھ مفت آزمائشی سبق بک کریں، پھر فیصلہ کریں۔"
      },
      {
        q: "کلاسیں کب ہوتی ہیں؟",
        a: "صبح، دوپہر اور شام کے گروپس ہیں، آن لائن اور کیمپس میں۔"
      },
      {
        q: "کیا آپ بچوں کو پڑھاتے ہیں؟",
        a: "جی ہاں۔ بچوں کا پروگرام 5 سے 14 سال کی عمر کے لیے قرآن، عربی اور اسلامی علوم پر مشتمل ہے۔"
      },
      {
        q: "کیا میں مصر سے باہر رہ کر پڑھ سکتا ہوں؟",
        a: "جی ہاں۔ براہِ راست آن لائن کلاسیں دنیا بھر میں ہوتی ہیں، دہرانے کے لیے ریکارڈنگز اور مواد کے ساتھ۔"
      },
      {
        q: "کیمپس کہاں ہیں؟",
        a: "نصر سٹی، قاہرہ کے ساتویں ضلع میں دو شاخیں: 37 عبد الشافی محمد اور 6 فضل بن ربیع۔"
      }
    ]
  },
  cta: {
    title: "مفت آزمائشی سبق سے آغاز کریں۔",
    text: "ہمیں بتائیں کہ آپ کیا سیکھنا چاہتے ہیں۔ ہم آپ کے لیول ٹیسٹ اور آزمائشی سبق کا وقت بتائیں گے۔",
    trial: "مفت آزمائشی سبق بک کریں",
    whatsapp: "واٹس ایپ پر پیغام بھیجیں"
  },
  footer: {
    tagline: "روشن مستقبل کے لیے تعلیم، ایک ایک طالب علم کے ساتھ۔",
    programmes: "پروگرامز",
    school: "اسکول",
    contact: "رابطہ",
    about: "ہمارے بارے میں",
    faq: "سوالات",
    verify: "سرٹیفکیٹ کی تصدیق کریں",
    privacy: "رازداری",
    terms: "شرائط",
    staff: "عملے کا سائن ان",
    rights: "نائل لرننگ سینٹر۔ جملہ حقوق محفوظ ہیں۔"
  }
};

export const LANDING_COPY: Record<LandingLocale, LandingCopy> = { en, ar, tr, zh, ru, ur };
export const LANDING_LOCALES: LandingLocale[] = ["en", "ar", "tr", "zh", "ru", "ur"];

/** Right-to-left languages on the public site. */
export const RTL_LOCALES: LandingLocale[] = ["ar", "ur"];
