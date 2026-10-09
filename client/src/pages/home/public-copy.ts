import type { LandingLocale } from "./landing-copy";

/**
 * Copy for the public pages beyond the landing: programmes, course pages,
 * certificate check, booking fallback, questions, contact, about, legal and
 * not-found. English is the source; Arabic and Turkish must match its shape.
 * Facts follow nilecenter.edu.eg; legal pages summarise and link to the
 * official policies rather than invent terms.
 */
const en = {
  courses: {
    quran: { level: "Beginner to Ijāzah", schedule: "Live online and on campus", outcomes: ["Recite with correct Tajweed", "Memorise with a steady plan", "Prepare for an Ijāzah"] },
    arabic: { level: "A1 to advanced", schedule: "Morning, afternoon and evening groups", outcomes: ["Read connected Arabic text", "Build grammar you can use", "Speak with confidence"] },
    "islamic-studies": { level: "Foundations to intermediate", schedule: "Weekly live cohorts", outcomes: ["Understand Qur’anic Arabic", "Study core texts with a teacher", "Ask and discuss with care"] },
    kids: { level: "Ages 5 to 14", schedule: "After school and weekends", outcomes: ["Read and write Arabic letters", "Recite and memorise short surahs", "Learn in a warm small group"] },
    turkish: { level: "A1 to B2", schedule: "Small group classes", outcomes: ["Handle daily conversations", "Read everyday Turkish", "Prepare for study or travel"] },
    english: { level: "All levels", schedule: "Small focused groups", outcomes: ["Speak more fluently", "Write clearly", "Build academic skills"] },
    "teacher-training": { level: "For practising teachers", schedule: "Cohorts through the year", outcomes: ["Plan clear lessons", "Manage a lively classroom", "Assess fairly and usefully"] },
    enterprise: { level: "Built with you", schedule: "Designed around your group", outcomes: ["A programme fitted to your goals", "Reports on progress", "Online, on campus or on site"] },
  },
  catalog: {
    eyebrow: "Programmes",
    title: "Find your path at Nile Center.",
    lead: "Every programme starts with a free placement test, so you begin at your level.",
    search: "Search programmes",
    placeholder: "Arabic, Tajweed, kids…",
    all: "All",
    empty: "No programme matches that search.",
    clear: "Clear search",
    count: "programmes",
  },
  course: {
    back: "All programmes",
    level: "Level",
    schedule: "When",
    format: "Where",
    formatValue: "Online or on campus in Nasr City",
    outcomesTitle: "What you will be able to do",
    runTitle: "How a course runs",
    run: [
      { title: "Placement", text: "A free test finds your level and the right group." },
      { title: "Core lessons", text: "Live classes with a certified teacher, at your group’s time." },
      { title: "Practice and feedback", text: "Homework, recordings and notes from your teacher." },
      { title: "Assessment", text: "Regular checks, and a certificate when you complete the level." },
    ],
    certificateTitle: "Certificates you can verify",
    certificateText: "Each certificate carries a code anyone can check on our site.",
    verify: "Verify a certificate",
    ctaTitle: "Start with a free trial lesson.",
    ctaText: "Sit a real class before you decide. Placement tests are free too.",
    missingTitle: "We could not find that programme.",
    missingText: "It may have moved. See every programme instead.",
  },
  verify: {
    eyebrow: "Certificates",
    title: "Verify a Nile Center certificate.",
    lead: "Enter the code printed on the certificate. Only issued certificates can be checked.",
    label: "Verification code",
    placeholder: "e.g. NCL-AR2-1234",
    submit: "Verify",
    checking: "Checking",
    checkingText: "Looking for an issued certificate with this code.",
    found: "Certificate verified",
    verified: "Verified",
    issued: "Issued",
    print: "Print or save as PDF",
    required: "Enter the certificate code.",
    unavailable: "Verification is unavailable right now. Try again later.",
    notFound: "No issued certificate has this code",
    notFoundText: "Check the code for typing mistakes, or contact us.",
  },
  booking: {
    trialEyebrow: "Free trial lesson",
    placementEyebrow: "Free placement test",
    trialTitle: "Book a free trial lesson.",
    placementTitle: "Book a free placement test.",
    trialLead: "Tell us what you want to learn and when you are free. Our admissions team will contact you.",
    placementLead: "Pick a subject and a day that suits you. The test takes about thirty minutes.",
    fullName: "Full name",
    email: "Email",
    phone: "Phone or WhatsApp",
    country: "Country",
    language: "Language you prefer",
    subject: "Subject",
    ageGroup: "Who is learning",
    schedule: "Times that suit you",
    schedulePlaceholder: "Weekday evenings, weekends…",
    branch: "Where",
    date: "Preferred day",
    level: "Current level",
    notes: "Anything else",
    choose: "Choose",
    languages: ["English", "Arabic", "Turkish", "French"],
    ages: ["Child", "Teen", "Adult", "A group or organisation"],
    levels: ["Complete beginner", "Can read a little", "Intermediate", "Advanced"],
    branches: [
      { value: "Cairo B1", label: "Nasr City campus" },
      { value: "Online", label: "Online" },
    ],
    submit: "Send request",
    sending: "Sending",
    invalid: "Fill in your name, a valid email, your phone and the other required choices.",
    failed: "We could not send your request. Try again, or message us on WhatsApp.",
    success: "Thank you. Your request is with our admissions team.",
  },
  faq: {
    eyebrow: "Questions",
    title: "Answers before you start.",
    lead: "The questions families and learners ask us most.",
    items: [
      { q: "How do I know which level to join?", a: "Every learner starts with a free placement test of about thirty minutes, online or on campus. Your teacher uses it to place you in the right group." },
      { q: "Can I try a class before I pay?", a: "Yes. Book a free trial lesson and sit a real class with a certified teacher before you decide." },
      { q: "Do you teach online?", a: "Yes. Live online classes run for learners around the world, with recordings and materials on your learning platform." },
      { q: "Where are your campuses?", a: "We have two campuses in Nasr City, Cairo: 37 Abd Al-Shafy Mohammed and 6 Fadl ibn Rabea, both in the 7th District." },
      { q: "When are classes held?", a: "Groups run in the morning, afternoon and evening, so you can choose a time that fits your day." },
      { q: "Do children have their own programme?", a: "Yes. Our kids programme covers Qur’an, Arabic and Islamic studies for ages 5 to 14, in small groups." },
      { q: "Will I get a certificate?", a: "When you complete a level you receive a certificate with a code that anyone can verify on this site." },
      { q: "Can you teach our school or organisation?", a: "Yes. We design programmes with schools, companies, mosques and communities. Contact us to talk it through." },
    ],
    moreTitle: "Still have a question?",
    moreText: "Message our admissions team and we will help you choose.",
    whatsapp: "Message us on WhatsApp",
  },
  contact: {
    eyebrow: "Contact",
    title: "Talk to our admissions team.",
    lead: "Message us on WhatsApp, call, or visit one of our two campuses in Nasr City.",
    campusesTitle: "Our campuses",
    campuses: [
      { name: "Branch 1", address: "37 Abd Al-Shafy Mohammed, 7th District, Nasr City, Cairo", query: "Nile Learning Center Branch 1 Nasr City" },
      { name: "Branch 2", address: "6 Fadl ibn Rabea, 7th District, Nasr City, Cairo", query: "Nile Learning Center Branch 2 Nasr City" },
    ],
    directions: "Get directions",
    reachTitle: "Reach us",
    emailLabel: "Email",
    startTitle: "Ready to begin?",
    startText: "Most learners start with one of these.",
  },
  about: {
    eyebrow: "About us",
    title: "Education for a brighter future.",
    lead: "Since 1998, Nile Center has taught Arabic, the Qur’an and Islamic studies to learners in Cairo and around the world.",
    storyTitle: "Our story",
    story: [
      "Nile Center began in Cairo with a simple aim: teach Arabic and the Qur’an with care, at each learner’s level.",
      "Today our teachers work with children, adults and organisations, live online and on two campuses in Nasr City, one learner at a time.",
    ],
    figuresTitle: "Nile Center in numbers",
    ctaTitle: "Come and see how we teach.",
    ctaText: "Book a free trial lesson, online or on campus.",
  },
  privacy: {
    eyebrow: "Privacy",
    title: "Your information at Nile Center.",
    lead: "A short summary of how this site handles what you share. The full policy is on our main site.",
    sections: [
      { h: "What we collect", p: "When you send a form, we receive what you type in it, such as your name, contact details and the course you are interested in." },
      { h: "Why we use it", p: "We use it to answer your enquiry, arrange placement tests and trial lessons, and run your classes if you join." },
      { h: "Who can see it", p: "Nile Center staff who need it for admissions and teaching. Staff sign in to a protected workspace." },
      { h: "Your choices", p: "You can ask to see, correct or delete your information by emailing us." },
    ],
    full: "Read the full privacy policy",
  },
  terms: {
    eyebrow: "Terms",
    title: "Terms for learning with us.",
    lead: "A short summary. The full terms and conditions are on our main site and apply to every enrolment.",
    sections: [
      { h: "Placement and trial", p: "Placement tests and trial lessons are free. They help us place you in the right group." },
      { h: "Enrolment", p: "Your place in a class is confirmed once your enrolment and payment are recorded by our team." },
      { h: "Attendance", p: "Regular attendance helps your progress. Your teacher records attendance for every session." },
      { h: "Certificates", p: "Certificates are issued when you complete a level, and each one can be verified on this site." },
    ],
    full: "Read the full terms and conditions",
  },
  notFound: {
    title: "We could not find that page.",
    text: "The link may be old, or the page has moved.",
    home: "Go to the home page",
    programmes: "See our programmes",
  },
};

export type PublicCopy = typeof en;

const ar: PublicCopy = {
  courses: {
    quran: { level: "من البداية حتى الإجازة", schedule: "مباشر أونلاين وحضوري", outcomes: ["التلاوة بتجويد صحيح", "الحفظ بخطة ثابتة", "الاستعداد للإجازة"] },
    arabic: { level: "من A1 حتى المتقدم", schedule: "مجموعات صباحية وظهرية ومسائية", outcomes: ["قراءة نصوص عربية متصلة", "نحو تستطيع استخدامه", "التحدث بثقة"] },
    "islamic-studies": { level: "من الأسس حتى المتوسط", schedule: "مجموعات مباشرة أسبوعية", outcomes: ["فهم العربية القرآنية", "دراسة المتون الأساسية مع معلم", "السؤال والنقاش بأدب"] },
    kids: { level: "من 5 إلى 14 سنة", schedule: "بعد المدرسة وفي العطلات", outcomes: ["قراءة الحروف العربية وكتابتها", "تلاوة قصار السور وحفظها", "التعلم في مجموعة صغيرة دافئة"] },
    turkish: { level: "من A1 حتى B2", schedule: "مجموعات صغيرة", outcomes: ["إدارة المحادثات اليومية", "قراءة التركية اليومية", "الاستعداد للدراسة أو السفر"] },
    english: { level: "كل المستويات", schedule: "مجموعات صغيرة مركّزة", outcomes: ["التحدث بطلاقة أكبر", "الكتابة بوضوح", "بناء المهارات الأكاديمية"] },
    "teacher-training": { level: "للمعلمين الممارسين", schedule: "دفعات على مدار العام", outcomes: ["تخطيط دروس واضحة", "إدارة فصل حيوي", "تقييم عادل ومفيد"] },
    enterprise: { level: "نصممه معكم", schedule: "يُصمَّم حول مجموعتكم", outcomes: ["برنامج يناسب أهدافكم", "تقارير عن التقدم", "أونلاين أو في مقرنا أو لديكم"] },
  },
  catalog: {
    eyebrow: "البرامج",
    title: "اعثر على مسارك في مركز النيل.",
    lead: "يبدأ كل برنامج باختبار مستوى مجاني، لتبدأ من مستواك.",
    search: "ابحث في البرامج",
    placeholder: "العربية، التجويد، الأطفال…",
    all: "الكل",
    empty: "لا يوجد برنامج يطابق هذا البحث.",
    clear: "مسح البحث",
    count: "برامج",
  },
  course: {
    back: "كل البرامج",
    level: "المستوى",
    schedule: "المواعيد",
    format: "المكان",
    formatValue: "أونلاين أو حضوري في مدينة نصر",
    outcomesTitle: "ما الذي ستتمكن منه",
    runTitle: "كيف تسير الدورة",
    run: [
      { title: "تحديد المستوى", text: "اختبار مجاني يحدد مستواك والمجموعة المناسبة." },
      { title: "الدروس الأساسية", text: "حصص مباشرة مع معلم معتمد في موعد مجموعتك." },
      { title: "التدريب والملاحظات", text: "واجبات وتسجيلات وملاحظات من معلمك." },
      { title: "التقييم", text: "متابعة منتظمة، وشهادة عند إتمام المستوى." },
    ],
    certificateTitle: "شهادات يمكن التحقق منها",
    certificateText: "تحمل كل شهادة رمزًا يمكن لأي أحد التحقق منه على موقعنا.",
    verify: "تحقق من شهادة",
    ctaTitle: "ابدأ بحصة تجريبية مجانية.",
    ctaText: "احضر حصة حقيقية قبل أن تقرر. اختبار المستوى مجاني أيضًا.",
    missingTitle: "لم نعثر على هذا البرنامج.",
    missingText: "ربما نُقل. اطّلع على كل البرامج.",
  },
  verify: {
    eyebrow: "الشهادات",
    title: "تحقق من شهادة مركز النيل.",
    lead: "أدخل الرمز المطبوع على الشهادة. يمكن التحقق من الشهادات الصادرة فقط.",
    label: "رمز التحقق",
    placeholder: "مثال: NCL-AR2-1234",
    submit: "تحقق",
    checking: "جارٍ التحقق",
    checkingText: "نبحث عن شهادة صادرة بهذا الرمز.",
    found: "تم التحقق من الشهادة",
    verified: "موثّقة",
    issued: "تاريخ الإصدار",
    print: "طباعة أو حفظ PDF",
    required: "أدخل رمز الشهادة.",
    unavailable: "التحقق غير متاح الآن. حاول لاحقًا.",
    notFound: "لا توجد شهادة صادرة بهذا الرمز",
    notFoundText: "راجع الرمز من أخطاء الكتابة، أو تواصل معنا.",
  },
  booking: {
    trialEyebrow: "حصة تجريبية مجانية",
    placementEyebrow: "اختبار مستوى مجاني",
    trialTitle: "احجز حصة تجريبية مجانية.",
    placementTitle: "احجز اختبار مستوى مجاني.",
    trialLead: "أخبرنا بما تريد تعلّمه ومتى تكون متاحًا، وسيتواصل معك فريق القبول.",
    placementLead: "اختر المادة واليوم المناسب لك. يستغرق الاختبار نحو ثلاثين دقيقة.",
    fullName: "الاسم الكامل",
    email: "البريد الإلكتروني",
    phone: "الهاتف أو واتساب",
    country: "الدولة",
    language: "اللغة المفضلة",
    subject: "المادة",
    ageGroup: "من سيتعلم",
    schedule: "الأوقات المناسبة",
    schedulePlaceholder: "مساء أيام الأسبوع، العطلات…",
    branch: "المكان",
    date: "اليوم المفضل",
    level: "المستوى الحالي",
    notes: "ملاحظات أخرى",
    choose: "اختر",
    languages: ["الإنجليزية", "العربية", "التركية", "الفرنسية"],
    ages: ["طفل", "مراهق", "بالغ", "مجموعة أو مؤسسة"],
    levels: ["مبتدئ تمامًا", "أقرأ قليلًا", "متوسط", "متقدم"],
    branches: [
      { value: "Cairo B1", label: "مقر مدينة نصر" },
      { value: "Online", label: "أونلاين" },
    ],
    submit: "إرسال الطلب",
    sending: "جارٍ الإرسال",
    invalid: "أدخل اسمك وبريدًا صحيحًا وهاتفك وبقية الاختيارات المطلوبة.",
    failed: "تعذر إرسال طلبك. حاول مرة أخرى أو راسلنا على واتساب.",
    success: "شكرًا لك. وصل طلبك إلى فريق القبول.",
  },
  faq: {
    eyebrow: "الأسئلة",
    title: "إجابات قبل أن تبدأ.",
    lead: "أكثر الأسئلة التي تطرحها علينا الأسر والمتعلمون.",
    items: [
      { q: "كيف أعرف المستوى المناسب لي؟", a: "يبدأ كل متعلم باختبار مستوى مجاني مدته نحو ثلاثين دقيقة أونلاين أو في المقر، ويستخدمه المعلم لوضعك في المجموعة المناسبة." },
      { q: "هل يمكنني تجربة حصة قبل الدفع؟", a: "نعم. احجز حصة تجريبية مجانية واحضر حصة حقيقية مع معلم معتمد قبل أن تقرر." },
      { q: "هل تدرّسون أونلاين؟", a: "نعم. حصص مباشرة أونلاين لمتعلمين حول العالم، مع تسجيلات ومواد على منصتك التعليمية." },
      { q: "أين مقراتكم؟", a: "لدينا فرعان في مدينة نصر بالقاهرة: 37 شارع عبد الشافي محمد و6 شارع الفضل بن الربيع، وكلاهما في الحي السابع." },
      { q: "متى تُعقد الحصص؟", a: "تعمل المجموعات صباحًا وظهرًا ومساءً، لتختار وقتًا يناسب يومك." },
      { q: "هل للأطفال برنامج خاص؟", a: "نعم. يشمل برنامج الأطفال القرآن والعربية والدراسات الإسلامية للأعمار من 5 إلى 14 سنة في مجموعات صغيرة." },
      { q: "هل سأحصل على شهادة؟", a: "عند إتمام المستوى تحصل على شهادة برمز يمكن لأي أحد التحقق منه على هذا الموقع." },
      { q: "هل يمكنكم التدريس لمدرستنا أو مؤسستنا؟", a: "نعم. نصمم برامج مع المدارس والشركات والمساجد والمجتمعات. تواصل معنا لنتحدث." },
    ],
    moreTitle: "لديك سؤال آخر؟",
    moreText: "راسل فريق القبول وسنساعدك في الاختيار.",
    whatsapp: "راسلنا على واتساب",
  },
  contact: {
    eyebrow: "تواصل معنا",
    title: "تحدّث إلى فريق القبول.",
    lead: "راسلنا على واتساب، أو اتصل بنا، أو زر أحد فرعينا في مدينة نصر.",
    campusesTitle: "فروعنا",
    campuses: [
      { name: "الفرع الأول", address: "37 شارع عبد الشافي محمد، الحي السابع، مدينة نصر، القاهرة", query: "Nile Learning Center Branch 1 Nasr City" },
      { name: "الفرع الثاني", address: "6 شارع الفضل بن الربيع، الحي السابع، مدينة نصر، القاهرة", query: "Nile Learning Center Branch 2 Nasr City" },
    ],
    directions: "الاتجاهات",
    reachTitle: "طرق التواصل",
    emailLabel: "البريد الإلكتروني",
    startTitle: "مستعد للبدء؟",
    startText: "يبدأ معظم المتعلمين بأحد هذين.",
  },
  about: {
    eyebrow: "من نحن",
    title: "تعليم من أجل مستقبل أفضل.",
    lead: "منذ عام 1998 يُعلّم مركز النيل العربية والقرآن والدراسات الإسلامية لمتعلمين في القاهرة وحول العالم.",
    storyTitle: "قصتنا",
    story: [
      "بدأ مركز النيل في القاهرة بهدف بسيط: تعليم العربية والقرآن بعناية، وعلى قدر مستوى كل متعلم.",
      "واليوم يعمل معلمونا مع الأطفال والبالغين والمؤسسات، مباشرة أونلاين وفي فرعين بمدينة نصر، متعلمًا بعد متعلم.",
    ],
    figuresTitle: "مركز النيل بالأرقام",
    ctaTitle: "تعال وشاهد كيف نُعلّم.",
    ctaText: "احجز حصة تجريبية مجانية أونلاين أو في المقر.",
  },
  privacy: {
    eyebrow: "الخصوصية",
    title: "معلوماتك في مركز النيل.",
    lead: "ملخص قصير لكيفية تعامل هذا الموقع مع ما تشاركه. السياسة الكاملة على موقعنا الرئيسي.",
    sections: [
      { h: "ما الذي نجمعه", p: "عند إرسال استمارة نستلم ما تكتبه فيها، مثل اسمك وبيانات التواصل والدورة التي تهتم بها." },
      { h: "لماذا نستخدمه", p: "للرد على استفسارك، وترتيب اختبارات المستوى والحصص التجريبية، وإدارة حصصك إذا انضممت." },
      { h: "من يمكنه رؤيته", p: "موظفو مركز النيل الذين يحتاجونه للقبول والتدريس، عبر مساحة عمل محمية بتسجيل الدخول." },
      { h: "خياراتك", p: "يمكنك طلب الاطلاع على معلوماتك أو تصحيحها أو حذفها عبر مراسلتنا بالبريد الإلكتروني." },
    ],
    full: "اقرأ سياسة الخصوصية كاملة",
  },
  terms: {
    eyebrow: "الشروط",
    title: "شروط التعلّم معنا.",
    lead: "ملخص قصير. الشروط والأحكام الكاملة على موقعنا الرئيسي وتسري على كل التحاق.",
    sections: [
      { h: "تحديد المستوى والتجربة", p: "اختبارات المستوى والحصص التجريبية مجانية، وتساعدنا على وضعك في المجموعة المناسبة." },
      { h: "الالتحاق", p: "يتأكد مكانك في الفصل بعد أن يسجّل فريقنا التحاقك ودفعتك." },
      { h: "الحضور", p: "الحضور المنتظم يدعم تقدمك، ويسجّل معلمك الحضور في كل حصة." },
      { h: "الشهادات", p: "تصدر الشهادات عند إتمام المستوى، ويمكن التحقق من كل شهادة على هذا الموقع." },
    ],
    full: "اقرأ الشروط والأحكام كاملة",
  },
  notFound: {
    title: "لم نعثر على هذه الصفحة.",
    text: "ربما يكون الرابط قديمًا، أو نُقلت الصفحة.",
    home: "الذهاب إلى الصفحة الرئيسية",
    programmes: "اطّلع على برامجنا",
  },
};

const tr: PublicCopy = {
  courses: {
    quran: { level: "Başlangıçtan icazete", schedule: "Canlı çevrim içi ve kampüste", outcomes: ["Doğru tecvidle okumak", "Düzenli bir planla ezberlemek", "İcazete hazırlanmak"] },
    arabic: { level: "A1’den ileri seviyeye", schedule: "Sabah, öğleden sonra ve akşam grupları", outcomes: ["Bağlantılı Arapça metin okumak", "Kullanabileceğiniz dil bilgisi", "Kendinizden emin konuşmak"] },
    "islamic-studies": { level: "Temelden orta seviyeye", schedule: "Haftalık canlı gruplar", outcomes: ["Kur’an Arapçasını anlamak", "Temel metinleri öğretmenle çalışmak", "Saygıyla soru sorup tartışmak"] },
    kids: { level: "5-14 yaş", schedule: "Okul sonrası ve hafta sonu", outcomes: ["Arapça harfleri okuyup yazmak", "Kısa sureleri okuyup ezberlemek", "Sıcak küçük bir grupta öğrenmek"] },
    turkish: { level: "A1’den B2’ye", schedule: "Küçük gruplar", outcomes: ["Günlük konuşmaları yürütmek", "Gündelik Türkçe okumak", "Eğitim veya seyahate hazırlanmak"] },
    english: { level: "Tüm seviyeler", schedule: "Küçük odaklı gruplar", outcomes: ["Daha akıcı konuşmak", "Açık yazmak", "Akademik beceriler kazanmak"] },
    "teacher-training": { level: "Görevdeki öğretmenler için", schedule: "Yıl boyunca dönemler", outcomes: ["Net dersler planlamak", "Canlı bir sınıfı yönetmek", "Adil ve yararlı ölçmek"] },
    enterprise: { level: "Sizinle birlikte", schedule: "Grubunuza göre tasarlanır", outcomes: ["Hedeflerinize uygun bir program", "İlerleme raporları", "Çevrim içi, kampüste veya sizde"] },
  },
  catalog: {
    eyebrow: "Programlar",
    title: "Nil Merkezi’nde yolunuzu bulun.",
    lead: "Her program ücretsiz bir seviye sınavıyla başlar; böylece kendi seviyenizden başlarsınız.",
    search: "Programlarda ara",
    placeholder: "Arapça, tecvid, çocuklar…",
    all: "Tümü",
    empty: "Bu aramayla eşleşen program yok.",
    clear: "Aramayı temizle",
    count: "program",
  },
  course: {
    back: "Tüm programlar",
    level: "Seviye",
    schedule: "Zaman",
    format: "Yer",
    formatValue: "Çevrim içi veya Nasr City kampüsünde",
    outcomesTitle: "Neler yapabileceksiniz",
    runTitle: "Bir kurs nasıl ilerler",
    run: [
      { title: "Seviye belirleme", text: "Ücretsiz bir sınav seviyenizi ve doğru grubu bulur." },
      { title: "Temel dersler", text: "Grubunuzun saatinde sertifikalı bir öğretmenle canlı dersler." },
      { title: "Alıştırma ve geri bildirim", text: "Ödevler, kayıtlar ve öğretmeninizden notlar." },
      { title: "Değerlendirme", text: "Düzenli kontroller ve seviyeyi bitirdiğinizde bir sertifika." },
    ],
    certificateTitle: "Doğrulanabilir sertifikalar",
    certificateText: "Her sertifikada, sitemizde herkesin kontrol edebileceği bir kod bulunur.",
    verify: "Sertifika doğrula",
    ctaTitle: "Ücretsiz bir deneme dersiyle başlayın.",
    ctaText: "Karar vermeden gerçek bir derse katılın. Seviye sınavı da ücretsiz.",
    missingTitle: "Bu programı bulamadık.",
    missingText: "Taşınmış olabilir. Tüm programlara göz atın.",
  },
  verify: {
    eyebrow: "Sertifikalar",
    title: "Bir Nil Merkezi sertifikasını doğrulayın.",
    lead: "Sertifikadaki kodu girin. Yalnızca düzenlenmiş sertifikalar kontrol edilebilir.",
    label: "Doğrulama kodu",
    placeholder: "örn. NCL-AR2-1234",
    submit: "Doğrula",
    checking: "Kontrol ediliyor",
    checkingText: "Bu kodla düzenlenmiş bir sertifika aranıyor.",
    found: "Sertifika doğrulandı",
    verified: "Doğrulandı",
    issued: "Düzenlenme",
    print: "Yazdır veya PDF olarak kaydet",
    required: "Sertifika kodunu girin.",
    unavailable: "Doğrulama şu anda kullanılamıyor. Daha sonra tekrar deneyin.",
    notFound: "Bu kodla düzenlenmiş bir sertifika yok",
    notFoundText: "Kodu yazım hatalarına karşı kontrol edin veya bizimle iletişime geçin.",
  },
  booking: {
    trialEyebrow: "Ücretsiz deneme dersi",
    placementEyebrow: "Ücretsiz seviye sınavı",
    trialTitle: "Ücretsiz bir deneme dersi alın.",
    placementTitle: "Ücretsiz bir seviye sınavı planlayın.",
    trialLead: "Ne öğrenmek istediğinizi ve ne zaman uygun olduğunuzu yazın. Kabul ekibimiz size ulaşacak.",
    placementLead: "Bir konu ve size uygun bir gün seçin. Sınav yaklaşık otuz dakika sürer.",
    fullName: "Ad soyad",
    email: "E-posta",
    phone: "Telefon veya WhatsApp",
    country: "Ülke",
    language: "Tercih ettiğiniz dil",
    subject: "Konu",
    ageGroup: "Kim öğrenecek",
    schedule: "Size uygun saatler",
    schedulePlaceholder: "Hafta içi akşam, hafta sonu…",
    branch: "Nerede",
    date: "Tercih edilen gün",
    level: "Mevcut seviye",
    notes: "Eklemek istedikleriniz",
    choose: "Seçin",
    languages: ["İngilizce", "Arapça", "Türkçe", "Fransızca"],
    ages: ["Çocuk", "Genç", "Yetişkin", "Bir grup veya kurum"],
    levels: ["Tam başlangıç", "Biraz okuyabiliyorum", "Orta", "İleri"],
    branches: [
      { value: "Cairo B1", label: "Nasr City kampüsü" },
      { value: "Online", label: "Çevrim içi" },
    ],
    submit: "Talebi gönder",
    sending: "Gönderiliyor",
    invalid: "Adınızı, geçerli bir e-postayı, telefonunuzu ve diğer zorunlu seçimleri doldurun.",
    failed: "Talebiniz gönderilemedi. Tekrar deneyin veya WhatsApp’tan yazın.",
    success: "Teşekkürler. Talebiniz kabul ekibimize ulaştı.",
  },
  faq: {
    eyebrow: "Sorular",
    title: "Başlamadan önce yanıtlar.",
    lead: "Ailelerin ve öğrencilerin bize en çok sorduğu sorular.",
    items: [
      { q: "Hangi seviyeye katılacağımı nasıl bilirim?", a: "Her öğrenci, çevrim içi veya kampüste yaklaşık otuz dakikalık ücretsiz bir seviye sınavıyla başlar. Öğretmeniniz sizi buna göre doğru gruba yerleştirir." },
      { q: "Ödemeden önce bir dersi deneyebilir miyim?", a: "Evet. Ücretsiz bir deneme dersi alın ve karar vermeden sertifikalı bir öğretmenle gerçek bir derse katılın." },
      { q: "Çevrim içi ders veriyor musunuz?", a: "Evet. Dünyanın her yerindeki öğrenciler için canlı çevrim içi dersler var; kayıtlar ve materyaller öğrenme platformunuzda." },
      { q: "Kampüsleriniz nerede?", a: "Kahire Nasr City’de iki kampüsümüz var: 37 Abd Al-Shafy Mohammed ve 6 Fadl ibn Rabea, ikisi de 7. Bölge’de." },
      { q: "Dersler ne zaman?", a: "Gruplar sabah, öğleden sonra ve akşam çalışır; gününüze uyan bir saati seçebilirsiniz." },
      { q: "Çocuklar için ayrı bir program var mı?", a: "Evet. Çocuk programımız 5-14 yaş için Kur’an, Arapça ve İslami ilimleri küçük gruplarda kapsar." },
      { q: "Sertifika alacak mıyım?", a: "Bir seviyeyi tamamladığınızda, bu sitede herkesin doğrulayabileceği kodlu bir sertifika alırsınız." },
      { q: "Okulumuza veya kurumumuza ders verebilir misiniz?", a: "Evet. Okullar, şirketler, camiler ve topluluklarla programlar tasarlıyoruz. Konuşmak için bize ulaşın." },
    ],
    moreTitle: "Başka bir sorunuz mu var?",
    moreText: "Kabul ekibimize yazın, seçiminizde yardımcı olalım.",
    whatsapp: "WhatsApp’tan yazın",
  },
  contact: {
    eyebrow: "İletişim",
    title: "Kabul ekibimizle konuşun.",
    lead: "WhatsApp’tan yazın, arayın veya Nasr City’deki iki kampüsümüzden birini ziyaret edin.",
    campusesTitle: "Kampüslerimiz",
    campuses: [
      { name: "1. Şube", address: "37 Abd Al-Shafy Mohammed, 7. Bölge, Nasr City, Kahire", query: "Nile Learning Center Branch 1 Nasr City" },
      { name: "2. Şube", address: "6 Fadl ibn Rabea, 7. Bölge, Nasr City, Kahire", query: "Nile Learning Center Branch 2 Nasr City" },
    ],
    directions: "Yol tarifi al",
    reachTitle: "Bize ulaşın",
    emailLabel: "E-posta",
    startTitle: "Başlamaya hazır mısınız?",
    startText: "Çoğu öğrenci bunlardan biriyle başlar.",
  },
  about: {
    eyebrow: "Hakkımızda",
    title: "Daha parlak bir gelecek için eğitim.",
    lead: "Nil Merkezi 1998’den beri Kahire’de ve dünyanın dört bir yanında Arapça, Kur’an ve İslami ilimler öğretiyor.",
    storyTitle: "Hikâyemiz",
    story: [
      "Nil Merkezi Kahire’de basit bir amaçla başladı: Arapçayı ve Kur’an’ı özenle, her öğrencinin seviyesinde öğretmek.",
      "Bugün öğretmenlerimiz çocuklar, yetişkinler ve kurumlarla çevrim içi ve Nasr City’deki iki kampüste, her seferinde bir öğrenciyle çalışıyor.",
    ],
    figuresTitle: "Rakamlarla Nil Merkezi",
    ctaTitle: "Gelin, nasıl öğrettiğimizi görün.",
    ctaText: "Çevrim içi veya kampüste ücretsiz bir deneme dersi alın.",
  },
  privacy: {
    eyebrow: "Gizlilik",
    title: "Nil Merkezi’nde bilgileriniz.",
    lead: "Bu sitenin paylaştıklarınızı nasıl ele aldığının kısa özeti. Tam politika ana sitemizdedir.",
    sections: [
      { h: "Ne topluyoruz", p: "Bir form gönderdiğinizde adınız, iletişim bilgileriniz ve ilgilendiğiniz kurs gibi yazdıklarınızı alırız." },
      { h: "Neden kullanıyoruz", p: "Sorunuzu yanıtlamak, seviye sınavı ve deneme dersi ayarlamak ve katılırsanız derslerinizi yürütmek için." },
      { h: "Kimler görebilir", p: "Kabul ve öğretim için ihtiyaç duyan Nil Merkezi personeli; personel korumalı bir çalışma alanına giriş yapar." },
      { h: "Seçenekleriniz", p: "Bize e-posta göndererek bilgilerinizi görmeyi, düzeltmeyi veya silmeyi isteyebilirsiniz." },
    ],
    full: "Gizlilik politikasının tamamını okuyun",
  },
  terms: {
    eyebrow: "Koşullar",
    title: "Bizimle öğrenme koşulları.",
    lead: "Kısa bir özet. Tam şartlar ve koşullar ana sitemizdedir ve her kayıt için geçerlidir.",
    sections: [
      { h: "Seviye sınavı ve deneme", p: "Seviye sınavları ve deneme dersleri ücretsizdir; sizi doğru gruba yerleştirmemize yardım eder." },
      { h: "Kayıt", p: "Sınıftaki yeriniz, kaydınız ve ödemeniz ekibimizce işlendiğinde kesinleşir." },
      { h: "Devam", p: "Düzenli devam ilerlemenize yardım eder. Öğretmeniniz her oturumda yoklama alır." },
      { h: "Sertifikalar", p: "Sertifikalar bir seviyeyi tamamladığınızda düzenlenir ve her biri bu sitede doğrulanabilir." },
    ],
    full: "Şartlar ve koşulların tamamını okuyun",
  },
  notFound: {
    title: "Bu sayfayı bulamadık.",
    text: "Bağlantı eski olabilir veya sayfa taşınmış olabilir.",
    home: "Ana sayfaya git",
    programmes: "Programlarımızı görün",
  },
};

const zh: PublicCopy = {
  courses: {
    quran: {
      level: "从入门到伊贾宰",
      schedule: "线上直播和校区面授",
      outcomes: [
        "以正确的泰吉威德规则诵读",
        "按稳定的计划背诵",
        "为获得伊贾宰做准备"
      ]
    },
    arabic: {
      level: "A1 到高级",
      schedule: "上午、下午和晚上小组",
      outcomes: [
        "阅读连贯的阿拉伯语文本",
        "掌握实用的语法",
        "自信地开口说"
      ]
    },
    "islamic-studies": {
      level: "从基础到中级",
      schedule: "每周直播小组",
      outcomes: [
        "理解《古兰经》阿拉伯语",
        "在教师指导下研读核心文本",
        "认真地提问与讨论"
      ]
    },
    kids: {
      level: "5 至 14 岁",
      schedule: "课后和周末",
      outcomes: [
        "读写阿拉伯字母",
        "诵读并背诵短章",
        "在温暖的小组中学习"
      ]
    },
    turkish: {
      level: "A1 到 B2",
      schedule: "小组课",
      outcomes: [
        "应对日常对话",
        "阅读日常土耳其语",
        "为学习或旅行做准备"
      ]
    },
    english: {
      level: "所有级别",
      schedule: "小而专注的小组",
      outcomes: [
        "说得更流利",
        "写得更清晰",
        "培养学术能力"
      ]
    },
    "teacher-training": {
      level: "面向在职教师",
      schedule: "全年开班",
      outcomes: [
        "设计清晰的课程",
        "管理活跃的课堂",
        "公平而有效地评估"
      ]
    },
    enterprise: {
      level: "与你共同打造",
      schedule: "围绕你的团体设计",
      outcomes: [
        "符合你目标的课程项目",
        "学习进度报告",
        "线上、校区或上门授课"
      ]
    }
  },
  catalog: {
    eyebrow: "课程项目",
    title: "在尼罗中心找到你的学习路径。",
    lead: "每个课程项目都从免费分级测试开始，让你从自己的水平起步。",
    search: "搜索课程项目",
    placeholder: "阿拉伯语、泰吉威德、少儿…",
    all: "全部",
    empty: "没有符合该搜索的课程项目。",
    clear: "清除搜索",
    count: "个课程项目"
  },
  course: {
    back: "所有课程项目",
    level: "级别",
    schedule: "时间",
    format: "地点",
    formatValue: "线上或纳斯尔城校区",
    outcomesTitle: "你将能够做到",
    runTitle: "课程如何进行",
    run: [
      {
        title: "分级",
        text: "免费测试会确定你的水平和合适的小组。"
      },
      {
        title: "核心课程",
        text: "在你所在小组的时间，与认证教师上直播课。"
      },
      {
        title: "练习与反馈",
        text: "作业、录像和教师的笔记。"
      },
      {
        title: "评估",
        text: "定期检查，完成该级别后颁发证书。"
      }
    ],
    certificateTitle: "可验证的证书",
    certificateText: "每张证书都带有一个代码，任何人都可以在我们的网站上查验。",
    verify: "验证证书",
    ctaTitle: "从免费试听课开始。",
    ctaText: "在做决定之前先上一节真正的课。分级测试同样免费。",
    missingTitle: "找不到该课程项目。",
    missingText: "它可能已经移动。请查看所有课程项目。"
  },
  verify: {
    eyebrow: "证书",
    title: "验证尼罗中心证书。",
    lead: "输入证书上印的代码。只能查验已颁发的证书。",
    label: "验证代码",
    placeholder: "例如 NCL-AR2-1234",
    submit: "验证",
    checking: "正在查验",
    checkingText: "正在查找使用此代码的已颁发证书。",
    found: "证书已验证",
    verified: "已验证",
    issued: "颁发日期",
    print: "打印或另存为 PDF",
    required: "请输入证书代码。",
    unavailable: "验证服务目前不可用。请稍后再试。",
    notFound: "没有使用此代码的已颁发证书",
    notFoundText: "请检查代码是否输错，或联系我们。"
  },
  booking: {
    trialEyebrow: "免费试听课",
    placementEyebrow: "免费分级测试",
    trialTitle: "预约免费试听课。",
    placementTitle: "预约免费分级测试。",
    trialLead: "告诉我们你想学什么以及何时有空。我们的招生团队会联系你。",
    placementLead: "选择一个科目和合适的日期。测试大约需要三十分钟。",
    fullName: "姓名",
    email: "电子邮箱",
    phone: "电话或 WhatsApp",
    country: "国家",
    language: "偏好语言",
    subject: "科目",
    ageGroup: "学员是谁",
    schedule: "合适的时间",
    schedulePlaceholder: "工作日晚上、周末…",
    branch: "地点",
    date: "希望的日期",
    level: "当前水平",
    notes: "其他信息",
    choose: "请选择",
    languages: [
      "英语",
      "阿拉伯语",
      "土耳其语",
      "法语"
    ],
    ages: [
      "儿童",
      "青少年",
      "成人",
      "团体或机构"
    ],
    levels: [
      "零基础",
      "能读一点",
      "中级",
      "高级"
    ],
    branches: [
      {
        value: "开罗 B1",
        label: "纳斯尔城校区"
      },
      {
        value: "线上",
        label: "线上"
      }
    ],
    submit: "发送请求",
    sending: "正在发送",
    invalid: "请填写姓名、有效的电子邮箱、电话以及其他必选项。",
    failed: "无法发送你的请求。请重试，或通过 WhatsApp 联系我们。",
    success: "谢谢。你的请求已提交给我们的招生团队。"
  },
  faq: {
    eyebrow: "常见问题",
    title: "开始之前的解答。",
    lead: "家长和学员最常问我们的问题。",
    items: [
      {
        q: "我怎么知道该加入哪个级别？",
        a: "每位学员都从大约三十分钟的免费分级测试开始，线上或在校区进行。教师会据此把你分到合适的小组。"
      },
      {
        q: "付款前可以先试听吗？",
        a: "可以。预约免费试听课，在做决定前与认证教师上一节真正的课。"
      },
      {
        q: "你们提供线上教学吗？",
        a: "提供。线上直播课程面向全球学员，学习平台上提供录像和资料。"
      },
      {
        q: "你们的校区在哪里？",
        a: "我们在开罗纳斯尔城有两个校区：Abd Al-Shafy Mohammed 街 37 号和 Fadl ibn Rabea 街 6 号，都在第七区。"
      },
      {
        q: "什么时候上课？",
        a: "小组分为上午、下午和晚上，你可以选择适合自己的时间。"
      },
      {
        q: "孩子有专门的课程吗？",
        a: "有。我们的少儿课程以小组形式为 5 至 14 岁儿童教授《古兰经》、阿拉伯语和伊斯兰研究。"
      },
      {
        q: "我会获得证书吗？",
        a: "完成一个级别后，你会获得一张带代码的证书，任何人都可以在本网站上查验。"
      },
      {
        q: "你们可以为我们的学校或机构授课吗？",
        a: "可以。我们与学校、企业、清真寺和社区共同设计课程。欢迎联系我们详谈。"
      }
    ],
    moreTitle: "还有问题？",
    moreText: "给我们的招生团队发消息，我们会帮你选择。",
    whatsapp: "通过 WhatsApp 联系我们"
  },
  contact: {
    eyebrow: "联系我们",
    title: "与我们的招生团队交流。",
    lead: "通过 WhatsApp 发消息、打电话，或前往我们在纳斯尔城的两个校区之一。",
    campusesTitle: "我们的校区",
    campuses: [
      {
        name: "第一校区",
        address: "开罗纳斯尔城第七区 Abd Al-Shafy Mohammed 街 37 号",
        query: "Nile Learning Center Branch 1 Nasr City"
      },
      {
        name: "第二校区",
        address: "开罗纳斯尔城第七区 Fadl ibn Rabea 街 6 号",
        query: "Nile Learning Center Branch 2 Nasr City"
      }
    ],
    directions: "获取路线",
    reachTitle: "联系方式",
    emailLabel: "电子邮箱",
    startTitle: "准备好开始了吗？",
    startText: "大多数学员从以下其中一项开始。"
  },
  about: {
    eyebrow: "关于我们",
    title: "教育成就更光明的未来。",
    lead: "自 1998 年起，尼罗中心为开罗及世界各地的学员教授阿拉伯语、《古兰经》和伊斯兰研究。",
    storyTitle: "我们的故事",
    story: [
      "尼罗中心在开罗起步，目标很简单：用心教授阿拉伯语和《古兰经》，并照顾每位学员的水平。",
      "如今，我们的教师通过线上直播和纳斯尔城的两个校区，为儿童、成人和机构授课，一次成就一位学员。"
    ],
    figuresTitle: "数说尼罗中心",
    ctaTitle: "来看看我们如何教学。",
    ctaText: "预约免费试听课，线上或在校区均可。"
  },
  privacy: {
    eyebrow: "隐私",
    title: "你在尼罗中心的信息。",
    lead: "本网站如何处理你所分享信息的简要说明。完整政策请见我们的主网站。",
    sections: [
      {
        h: "我们收集什么",
        p: "当你提交表单时，我们会收到你填写的内容，例如姓名、联系方式和你感兴趣的课程。"
      },
      {
        h: "我们为何使用",
        p: "我们用它来回复你的咨询、安排分级测试和试听课，并在你报名后组织你的课程。"
      },
      {
        h: "谁可以看到",
        p: "因招生和教学需要而使用这些信息的尼罗中心员工。员工需登录受保护的工作区。"
      },
      {
        h: "你的选择",
        p: "你可以发送邮件要求查看、更正或删除你的信息。"
      }
    ],
    full: "阅读完整的隐私政策"
  },
  terms: {
    eyebrow: "条款",
    title: "在本中心学习的条款。",
    lead: "简要说明。完整的条款与条件请见我们的主网站，适用于每一次报名。",
    sections: [
      {
        h: "分级测试和试听",
        p: "分级测试和试听课免费。它们帮助我们把你分到合适的小组。"
      },
      {
        h: "报名",
        p: "在我们的团队记录你的报名和付款后，你在班级中的名额才会确认。"
      },
      {
        h: "考勤",
        p: "按时上课有助于你的进步。教师会记录每节课的考勤。"
      },
      {
        h: "证书",
        p: "完成一个级别后颁发证书，每张证书都可以在本网站上查验。"
      }
    ],
    full: "阅读完整的条款与条件"
  },
  notFound: {
    title: "找不到该页面。",
    text: "链接可能已过期，或页面已经移动。",
    home: "前往首页",
    programmes: "查看我们的课程项目"
  }
};

const ru: PublicCopy = {
  courses: {
    quran: {
      level: "От начального уровня до иджазы",
      schedule: "Онлайн и очно",
      outcomes: [
        "Читать с правильным таджвидом",
        "Заучивать по устойчивому плану",
        "Подготовиться к иджазе"
      ]
    },
    arabic: {
      level: "От A1 до продвинутого",
      schedule: "Утренние, дневные и вечерние группы",
      outcomes: [
        "Читать связный арабский текст",
        "Освоить грамматику для практики",
        "Говорить уверенно"
      ]
    },
    "islamic-studies": {
      level: "От основ до среднего уровня",
      schedule: "Еженедельные онлайн-группы",
      outcomes: [
        "Понимать коранический арабский",
        "Изучать основные тексты с преподавателем",
        "Задавать вопросы и обсуждать бережно"
      ]
    },
    kids: {
      level: "От 5 до 14 лет",
      schedule: "После школы и по выходным",
      outcomes: [
        "Читать и писать арабские буквы",
        "Читать и заучивать короткие суры",
        "Учиться в тёплой небольшой группе"
      ]
    },
    turkish: {
      level: "От A1 до B2",
      schedule: "Занятия в небольших группах",
      outcomes: [
        "Вести повседневные разговоры",
        "Читать турецкие тексты на каждый день",
        "Подготовиться к учёбе или поездке"
      ]
    },
    english: {
      level: "Все уровни",
      schedule: "Небольшие группы",
      outcomes: [
        "Говорить свободнее",
        "Писать понятно",
        "Развить академические навыки"
      ]
    },
    "teacher-training": {
      level: "Для практикующих преподавателей",
      schedule: "Наборы в течение года",
      outcomes: [
        "Планировать понятные уроки",
        "Управлять живым классом",
        "Оценивать честно и с пользой"
      ]
    },
    enterprise: {
      level: "Создаём вместе с вами",
      schedule: "Под вашу группу",
      outcomes: [
        "Программа под ваши цели",
        "Отчёты о прогрессе",
        "Онлайн, в центре или у вас"
      ]
    }
  },
  catalog: {
    eyebrow: "Программы",
    title: "Найдите свой путь в Nile Center.",
    lead: "Каждая программа начинается с бесплатного теста на уровень, чтобы вы начали со своего уровня.",
    search: "Поиск программ",
    placeholder: "Арабский, таджвид, дети…",
    all: "Все",
    empty: "Нет программ по этому запросу.",
    clear: "Очистить поиск",
    count: "программ"
  },
  course: {
    back: "Все программы",
    level: "Уровень",
    schedule: "Когда",
    format: "Где",
    formatValue: "Онлайн или очно в Наср-Сити",
    outcomesTitle: "Чему вы научитесь",
    runTitle: "Как проходит курс",
    run: [
      {
        title: "Распределение",
        text: "Бесплатный тест определяет ваш уровень и подходящую группу."
      },
      {
        title: "Основные занятия",
        text: "Живые уроки с сертифицированным преподавателем во время вашей группы."
      },
      {
        title: "Практика и обратная связь",
        text: "Домашние задания, записи и заметки преподавателя."
      },
      {
        title: "Оценивание",
        text: "Регулярные проверки и сертификат по окончании уровня."
      }
    ],
    certificateTitle: "Сертификаты, которые можно проверить",
    certificateText: "У каждого сертификата есть код, который любой может проверить на нашем сайте.",
    verify: "Проверить сертификат",
    ctaTitle: "Начните с бесплатного пробного урока.",
    ctaText: "Посетите настоящее занятие, прежде чем решить. Тест на уровень тоже бесплатный.",
    missingTitle: "Мы не нашли эту программу.",
    missingText: "Возможно, она переехала. Посмотрите все программы."
  },
  verify: {
    eyebrow: "Сертификаты",
    title: "Проверка сертификата Nile Center.",
    lead: "Введите код, напечатанный на сертификате. Проверить можно только выданные сертификаты.",
    label: "Код проверки",
    placeholder: "например, NCL-AR2-1234",
    submit: "Проверить",
    checking: "Проверка",
    checkingText: "Ищем выданный сертификат с этим кодом.",
    found: "Сертификат подтверждён",
    verified: "Подтверждён",
    issued: "Выдан",
    print: "Распечатать или сохранить в PDF",
    required: "Введите код сертификата.",
    unavailable: "Проверка сейчас недоступна. Повторите позже.",
    notFound: "Выданного сертификата с этим кодом нет",
    notFoundText: "Проверьте код на опечатки или свяжитесь с нами."
  },
  booking: {
    trialEyebrow: "Бесплатный пробный урок",
    placementEyebrow: "Бесплатный тест на уровень",
    trialTitle: "Запишитесь на бесплатный пробный урок.",
    placementTitle: "Запишитесь на бесплатный тест на уровень.",
    trialLead: "Расскажите, что хотите изучать и когда вы свободны. С вами свяжется наша команда приёма.",
    placementLead: "Выберите предмет и удобный день. Тест длится около тридцати минут.",
    fullName: "Полное имя",
    email: "Эл. почта",
    phone: "Телефон или WhatsApp",
    country: "Страна",
    language: "Предпочитаемый язык",
    subject: "Предмет",
    ageGroup: "Кто будет учиться",
    schedule: "Удобное время",
    schedulePlaceholder: "Вечера будних дней, выходные…",
    branch: "Где",
    date: "Предпочтительный день",
    level: "Текущий уровень",
    notes: "Что-то ещё",
    choose: "Выберите",
    languages: [
      "Английский",
      "Арабский",
      "Турецкий",
      "Французский"
    ],
    ages: [
      "Ребёнок",
      "Подросток",
      "Взрослый",
      "Группа или организация"
    ],
    levels: [
      "Полный новичок",
      "Немного читаю",
      "Средний",
      "Продвинутый"
    ],
    branches: [
      {
        value: "Каир B1",
        label: "Филиал в Наср-Сити"
      },
      {
        value: "Онлайн",
        label: "Онлайн"
      }
    ],
    submit: "Отправить заявку",
    sending: "Отправка",
    invalid: "Укажите имя, корректную эл. почту, телефон и другие обязательные пункты.",
    failed: "Не удалось отправить заявку. Повторите попытку или напишите нам в WhatsApp.",
    success: "Спасибо. Ваша заявка передана нашей команде приёма."
  },
  faq: {
    eyebrow: "Вопросы",
    title: "Ответы до начала обучения.",
    lead: "Вопросы, которые семьи и ученики задают нам чаще всего.",
    items: [
      {
        q: "Как понять, в какой уровень записаться?",
        a: "Каждый ученик начинает с бесплатного теста на уровень длительностью около тридцати минут, онлайн или очно. По нему преподаватель определяет подходящую группу."
      },
      {
        q: "Можно ли попробовать занятие до оплаты?",
        a: "Да. Запишитесь на бесплатный пробный урок и посетите настоящее занятие с сертифицированным преподавателем, прежде чем решить."
      },
      {
        q: "Вы преподаёте онлайн?",
        a: "Да. Онлайн-занятия проходят для учеников по всему миру, с записями и материалами на вашей учебной платформе."
      },
      {
        q: "Где находятся ваши филиалы?",
        a: "У нас два филиала в Наср-Сити, Каир: ул. Абд аль-Шафи Мохаммед, 37, и ул. Фадль ибн Рабиа, 6, оба в 7-м районе."
      },
      {
        q: "Когда проходят занятия?",
        a: "Группы занимаются утром, днём и вечером, поэтому можно выбрать удобное время."
      },
      {
        q: "Есть ли отдельная программа для детей?",
        a: "Да. Детская программа охватывает Коран, арабский язык и исламские науки для детей от 5 до 14 лет в небольших группах."
      },
      {
        q: "Получу ли я сертификат?",
        a: "По окончании уровня вы получите сертификат с кодом, который любой может проверить на этом сайте."
      },
      {
        q: "Можете ли вы обучать нашу школу или организацию?",
        a: "Да. Мы создаём программы вместе со школами, компаниями, мечетями и общинами. Свяжитесь с нами, чтобы обсудить."
      }
    ],
    moreTitle: "Остались вопросы?",
    moreText: "Напишите нашей команде приёма, и мы поможем с выбором.",
    whatsapp: "Написать нам в WhatsApp"
  },
  contact: {
    eyebrow: "Контакты",
    title: "Свяжитесь с командой приёма.",
    lead: "Напишите нам в WhatsApp, позвоните или приходите в один из двух филиалов в Наср-Сити.",
    campusesTitle: "Наши филиалы",
    campuses: [
      {
        name: "Филиал 1",
        address: "ул. Абд аль-Шафи Мохаммед, 37, 7-й район, Наср-Сити, Каир",
        query: "Nile Learning Center Branch 1 Nasr City"
      },
      {
        name: "Филиал 2",
        address: "ул. Фадль ибн Рабиа, 6, 7-й район, Наср-Сити, Каир",
        query: "Nile Learning Center Branch 2 Nasr City"
      }
    ],
    directions: "Проложить маршрут",
    reachTitle: "Связаться с нами",
    emailLabel: "Эл. почта",
    startTitle: "Готовы начать?",
    startText: "Большинство учеников начинают с одного из этих шагов."
  },
  about: {
    eyebrow: "О нас",
    title: "Образование для светлого будущего.",
    lead: "С 1998 года Nile Center преподаёт арабский язык, Коран и исламские науки ученикам в Каире и по всему миру.",
    storyTitle: "Наша история",
    story: [
      "Nile Center начался в Каире с простой цели: бережно преподавать арабский язык и Коран с учётом уровня каждого ученика.",
      "Сегодня наши преподаватели работают с детьми, взрослыми и организациями онлайн и в двух филиалах в Наср-Сити — с каждым учеником лично."
    ],
    figuresTitle: "Nile Center в цифрах",
    ctaTitle: "Приходите посмотреть, как мы учим.",
    ctaText: "Запишитесь на бесплатный пробный урок онлайн или очно."
  },
  privacy: {
    eyebrow: "Конфиденциальность",
    title: "Ваши данные в Nile Center.",
    lead: "Краткое описание того, как сайт обращается с тем, чем вы делитесь. Полная политика — на нашем основном сайте.",
    sections: [
      {
        h: "Что мы собираем",
        p: "Когда вы отправляете форму, мы получаем введённые данные: имя, контакты и интересующий вас курс."
      },
      {
        h: "Зачем мы их используем",
        p: "Чтобы ответить на ваш запрос, назначить тест на уровень и пробный урок и вести ваши занятия, если вы запишетесь."
      },
      {
        h: "Кто их видит",
        p: "Сотрудники Nile Center, которым они нужны для приёма и обучения. Сотрудники входят в защищённое рабочее пространство."
      },
      {
        h: "Ваш выбор",
        p: "Вы можете попросить показать, исправить или удалить ваши данные, написав нам на эл. почту."
      }
    ],
    full: "Читать полную политику конфиденциальности"
  },
  terms: {
    eyebrow: "Условия",
    title: "Условия обучения у нас.",
    lead: "Краткое изложение. Полные условия — на нашем основном сайте; они действуют для каждой записи.",
    sections: [
      {
        h: "Тест и пробный урок",
        p: "Тесты на уровень и пробные уроки бесплатны. Они помогают определить подходящую группу."
      },
      {
        h: "Запись",
        p: "Место в группе подтверждается после того, как наша команда зафиксирует запись и оплату."
      },
      {
        h: "Посещаемость",
        p: "Регулярное посещение помогает прогрессу. Преподаватель отмечает посещаемость на каждом занятии."
      },
      {
        h: "Сертификаты",
        p: "Сертификаты выдаются по окончании уровня, и каждый можно проверить на этом сайте."
      }
    ],
    full: "Читать полные условия"
  },
  notFound: {
    title: "Мы не нашли эту страницу.",
    text: "Ссылка могла устареть, или страница переехала.",
    home: "На главную",
    programmes: "Посмотреть программы"
  }
};

const ur: PublicCopy = {
  courses: {
    quran: {
      level: "ابتدا سے اجازہ تک",
      schedule: "براہِ راست آن لائن اور کیمپس میں",
      outcomes: [
        "درست تجوید کے ساتھ تلاوت",
        "مستقل منصوبے کے ساتھ حفظ",
        "اجازہ کی تیاری"
      ]
    },
    arabic: {
      level: "A1 سے اعلیٰ سطح تک",
      schedule: "صبح، دوپہر اور شام کے گروپس",
      outcomes: [
        "مربوط عربی متن پڑھنا",
        "قابلِ استعمال قواعد سیکھنا",
        "اعتماد سے بولنا"
      ]
    },
    "islamic-studies": {
      level: "بنیاد سے درمیانی سطح تک",
      schedule: "ہفتہ وار براہِ راست گروپس",
      outcomes: [
        "قرآنی عربی سمجھنا",
        "استاد کے ساتھ بنیادی متون کا مطالعہ",
        "احتیاط سے سوال اور گفتگو"
      ]
    },
    kids: {
      level: "5 سے 14 سال",
      schedule: "اسکول کے بعد اور ہفتہ وار تعطیلات میں",
      outcomes: [
        "عربی حروف پڑھنا اور لکھنا",
        "چھوٹی سورتیں پڑھنا اور یاد کرنا",
        "گرم جوش چھوٹے گروپ میں سیکھنا"
      ]
    },
    turkish: {
      level: "A1 سے B2 تک",
      schedule: "چھوٹے گروپ کی کلاسیں",
      outcomes: [
        "روزمرہ گفتگو کرنا",
        "روزمرہ ترکی پڑھنا",
        "تعلیم یا سفر کی تیاری"
      ]
    },
    english: {
      level: "تمام سطحیں",
      schedule: "چھوٹے مرکوز گروپس",
      outcomes: [
        "زیادہ روانی سے بولنا",
        "واضح لکھنا",
        "تعلیمی مہارتیں بنانا"
      ]
    },
    "teacher-training": {
      level: "کام کرنے والے اساتذہ کے لیے",
      schedule: "سال بھر گروپس",
      outcomes: [
        "واضح اسباق کی منصوبہ بندی",
        "پُرجوش کلاس کا انتظام",
        "منصفانہ اور مفید جانچ"
      ]
    },
    enterprise: {
      level: "آپ کے ساتھ مل کر",
      schedule: "آپ کے گروپ کے مطابق تیار",
      outcomes: [
        "آپ کے اہداف کے مطابق پروگرام",
        "پیش رفت کی رپورٹس",
        "آن لائن، کیمپس میں یا آپ کی جگہ پر"
      ]
    }
  },
  catalog: {
    eyebrow: "پروگرامز",
    title: "نائل سینٹر میں اپنا راستہ تلاش کریں۔",
    lead: "ہر پروگرام مفت لیول ٹیسٹ سے شروع ہوتا ہے، تاکہ آپ اپنی سطح سے آغاز کریں۔",
    search: "پروگرامز تلاش کریں",
    placeholder: "عربی، تجوید، بچے…",
    all: "سب",
    empty: "اس تلاش سے کوئی پروگرام نہیں ملا۔",
    clear: "تلاش صاف کریں",
    count: "پروگرامز"
  },
  course: {
    back: "تمام پروگرامز",
    level: "سطح",
    schedule: "کب",
    format: "کہاں",
    formatValue: "آن لائن یا نصر سٹی کیمپس میں",
    outcomesTitle: "آپ کیا کر سکیں گے",
    runTitle: "کورس کیسے چلتا ہے",
    run: [
      {
        title: "درجہ بندی",
        text: "مفت ٹیسٹ آپ کی سطح اور مناسب گروپ طے کرتا ہے۔"
      },
      {
        title: "بنیادی اسباق",
        text: "آپ کے گروپ کے وقت پر مستند استاد کے ساتھ براہِ راست کلاسیں۔"
      },
      {
        title: "مشق اور رائے",
        text: "ہوم ورک، ریکارڈنگز اور استاد کے نوٹس۔"
      },
      {
        title: "جانچ",
        text: "باقاعدہ جانچ، اور سطح مکمل کرنے پر سرٹیفکیٹ۔"
      }
    ],
    certificateTitle: "قابلِ تصدیق سرٹیفکیٹس",
    certificateText: "ہر سرٹیفکیٹ پر ایک کوڈ ہوتا ہے جسے کوئی بھی ہماری سائٹ پر چیک کر سکتا ہے۔",
    verify: "سرٹیفکیٹ کی تصدیق کریں",
    ctaTitle: "مفت آزمائشی سبق سے آغاز کریں۔",
    ctaText: "فیصلہ کرنے سے پہلے ایک حقیقی کلاس میں بیٹھیں۔ لیول ٹیسٹ بھی مفت ہیں۔",
    missingTitle: "ہمیں یہ پروگرام نہیں ملا۔",
    missingText: "شاید یہ منتقل ہو گیا ہے۔ تمام پروگرامز دیکھیں۔"
  },
  verify: {
    eyebrow: "سرٹیفکیٹس",
    title: "نائل سینٹر کے سرٹیفکیٹ کی تصدیق کریں۔",
    lead: "سرٹیفکیٹ پر چھپا ہوا کوڈ درج کریں۔ صرف جاری کردہ سرٹیفکیٹس چیک ہو سکتے ہیں۔",
    label: "تصدیقی کوڈ",
    placeholder: "مثلاً NCL-AR2-1234",
    submit: "تصدیق کریں",
    checking: "جانچ ہو رہی ہے",
    checkingText: "اس کوڈ کا جاری کردہ سرٹیفکیٹ تلاش کیا جا رہا ہے۔",
    found: "سرٹیفکیٹ کی تصدیق ہو گئی",
    verified: "تصدیق شدہ",
    issued: "جاری کیا گیا",
    print: "پرنٹ کریں یا PDF کے طور پر محفوظ کریں",
    required: "سرٹیفکیٹ کا کوڈ درج کریں۔",
    unavailable: "تصدیق ابھی دستیاب نہیں۔ بعد میں کوشش کریں۔",
    notFound: "اس کوڈ کا کوئی جاری کردہ سرٹیفکیٹ نہیں",
    notFoundText: "کوڈ میں ٹائپنگ کی غلطی چیک کریں، یا ہم سے رابطہ کریں۔"
  },
  booking: {
    trialEyebrow: "مفت آزمائشی سبق",
    placementEyebrow: "مفت لیول ٹیسٹ",
    trialTitle: "مفت آزمائشی سبق بک کریں۔",
    placementTitle: "مفت لیول ٹیسٹ بک کریں۔",
    trialLead: "ہمیں بتائیں کہ آپ کیا سیکھنا چاہتے ہیں اور کب فارغ ہیں۔ ہماری داخلہ ٹیم آپ سے رابطہ کرے گی۔",
    placementLead: "کوئی مضمون اور مناسب دن منتخب کریں۔ ٹیسٹ تقریباً تیس منٹ کا ہوتا ہے۔",
    fullName: "پورا نام",
    email: "ای میل",
    phone: "فون یا واٹس ایپ",
    country: "ملک",
    language: "پسندیدہ زبان",
    subject: "مضمون",
    ageGroup: "کون سیکھ رہا ہے",
    schedule: "مناسب اوقات",
    schedulePlaceholder: "ہفتے کے دنوں کی شامیں، ہفتہ وار تعطیلات…",
    branch: "کہاں",
    date: "پسندیدہ دن",
    level: "موجودہ سطح",
    notes: "کچھ اور",
    choose: "منتخب کریں",
    languages: [
      "انگریزی",
      "عربی",
      "ترکی",
      "فرانسیسی"
    ],
    ages: [
      "بچہ",
      "نوعمر",
      "بالغ",
      "گروپ یا ادارہ"
    ],
    levels: [
      "بالکل نیا",
      "تھوڑا پڑھ سکتا ہوں",
      "درمیانی",
      "اعلیٰ"
    ],
    branches: [
      {
        value: "قاہرہ B1",
        label: "نصر سٹی کیمپس"
      },
      {
        value: "آن لائن",
        label: "آن لائن"
      }
    ],
    submit: "درخواست بھیجیں",
    sending: "بھیجی جا رہی ہے",
    invalid: "اپنا نام، درست ای میل، فون اور دیگر لازمی انتخاب پُر کریں۔",
    failed: "آپ کی درخواست نہیں بھیجی جا سکی۔ دوبارہ کوشش کریں، یا واٹس ایپ پر پیغام بھیجیں۔",
    success: "شکریہ۔ آپ کی درخواست ہماری داخلہ ٹیم کو مل گئی ہے۔"
  },
  faq: {
    eyebrow: "سوالات",
    title: "آغاز سے پہلے جوابات۔",
    lead: "وہ سوالات جو خاندان اور طلبہ ہم سے سب سے زیادہ پوچھتے ہیں۔",
    items: [
      {
        q: "مجھے کیسے پتہ چلے گا کہ کس سطح میں شامل ہوں؟",
        a: "ہر طالب علم تقریباً تیس منٹ کے مفت لیول ٹیسٹ سے آغاز کرتا ہے، آن لائن یا کیمپس میں۔ استاد اس کی مدد سے آپ کو مناسب گروپ میں رکھتا ہے۔"
      },
      {
        q: "کیا میں ادائیگی سے پہلے کلاس آزما سکتا ہوں؟",
        a: "جی ہاں۔ مفت آزمائشی سبق بک کریں اور فیصلہ کرنے سے پہلے مستند استاد کے ساتھ حقیقی کلاس میں بیٹھیں۔"
      },
      {
        q: "کیا آپ آن لائن پڑھاتے ہیں؟",
        a: "جی ہاں۔ دنیا بھر کے طلبہ کے لیے براہِ راست آن لائن کلاسیں ہوتی ہیں، آپ کے تعلیمی پلیٹ فارم پر ریکارڈنگز اور مواد کے ساتھ۔"
      },
      {
        q: "آپ کے کیمپس کہاں ہیں؟",
        a: "نصر سٹی، قاہرہ میں ہمارے دو کیمپس ہیں: 37 عبد الشافی محمد اور 6 فضل بن ربیع، دونوں ساتویں ضلع میں۔"
      },
      {
        q: "کلاسیں کب ہوتی ہیں؟",
        a: "گروپس صبح، دوپہر اور شام میں ہوتے ہیں، تاکہ آپ اپنے دن کے مطابق وقت منتخب کر سکیں۔"
      },
      {
        q: "کیا بچوں کا اپنا پروگرام ہے؟",
        a: "جی ہاں۔ ہمارا بچوں کا پروگرام چھوٹے گروپس میں 5 سے 14 سال کی عمر کے لیے قرآن، عربی اور اسلامی علوم پر مشتمل ہے۔"
      },
      {
        q: "کیا مجھے سرٹیفکیٹ ملے گا؟",
        a: "سطح مکمل کرنے پر آپ کو ایک کوڈ والا سرٹیفکیٹ ملتا ہے جس کی کوئی بھی اس سائٹ پر تصدیق کر سکتا ہے۔"
      },
      {
        q: "کیا آپ ہمارے اسکول یا ادارے کو پڑھا سکتے ہیں؟",
        a: "جی ہاں۔ ہم اسکولوں، کمپنیوں، مساجد اور برادریوں کے ساتھ مل کر پروگرام بناتے ہیں۔ بات کرنے کے لیے ہم سے رابطہ کریں۔"
      }
    ],
    moreTitle: "کوئی اور سوال؟",
    moreText: "ہماری داخلہ ٹیم کو پیغام بھیجیں، ہم انتخاب میں آپ کی مدد کریں گے۔",
    whatsapp: "واٹس ایپ پر پیغام بھیجیں"
  },
  contact: {
    eyebrow: "رابطہ",
    title: "ہماری داخلہ ٹیم سے بات کریں۔",
    lead: "واٹس ایپ پر پیغام بھیجیں، فون کریں، یا نصر سٹی میں ہمارے دو کیمپس میں سے کسی ایک پر تشریف لائیں۔",
    campusesTitle: "ہمارے کیمپس",
    campuses: [
      {
        name: "شاخ 1",
        address: "37 عبد الشافی محمد، ساتواں ضلع، نصر سٹی، قاہرہ",
        query: "Nile Learning Center Branch 1 Nasr City"
      },
      {
        name: "شاخ 2",
        address: "6 فضل بن ربیع، ساتواں ضلع، نصر سٹی، قاہرہ",
        query: "Nile Learning Center Branch 2 Nasr City"
      }
    ],
    directions: "راستہ دیکھیں",
    reachTitle: "ہم سے رابطہ کریں",
    emailLabel: "ای میل",
    startTitle: "آغاز کے لیے تیار ہیں؟",
    startText: "زیادہ تر طلبہ ان میں سے کسی ایک سے آغاز کرتے ہیں۔"
  },
  about: {
    eyebrow: "ہمارے بارے میں",
    title: "روشن مستقبل کے لیے تعلیم۔",
    lead: "1998 سے نائل سینٹر قاہرہ اور دنیا بھر کے طلبہ کو عربی، قرآن اور اسلامی علوم پڑھا رہا ہے۔",
    storyTitle: "ہماری کہانی",
    story: [
      "نائل سینٹر قاہرہ میں ایک سادہ مقصد کے ساتھ شروع ہوا: ہر طالب علم کی سطح کے مطابق، توجہ سے عربی اور قرآن پڑھانا۔",
      "آج ہمارے اساتذہ بچوں، بالغوں اور اداروں کے ساتھ براہِ راست آن لائن اور نصر سٹی کے دو کیمپس میں کام کرتے ہیں، ایک ایک طالب علم کے ساتھ۔"
    ],
    figuresTitle: "نائل سینٹر اعداد و شمار میں",
    ctaTitle: "آئیں اور دیکھیں کہ ہم کیسے پڑھاتے ہیں۔",
    ctaText: "مفت آزمائشی سبق بک کریں، آن لائن یا کیمپس میں۔"
  },
  privacy: {
    eyebrow: "رازداری",
    title: "نائل سینٹر میں آپ کی معلومات۔",
    lead: "یہ سائٹ آپ کی شیئر کردہ معلومات کو کیسے سنبھالتی ہے اس کا مختصر خلاصہ۔ مکمل پالیسی ہماری مرکزی سائٹ پر ہے۔",
    sections: [
      {
        h: "ہم کیا جمع کرتے ہیں",
        p: "جب آپ فارم بھیجتے ہیں تو ہمیں وہ ملتا ہے جو آپ اس میں لکھتے ہیں، جیسے آپ کا نام، رابطے کی تفصیلات اور جس کورس میں آپ کی دلچسپی ہے۔"
      },
      {
        h: "ہم اسے کیوں استعمال کرتے ہیں",
        p: "آپ کی پوچھ گچھ کا جواب دینے، لیول ٹیسٹ اور آزمائشی اسباق کا انتظام کرنے، اور شامل ہونے پر آپ کی کلاسیں چلانے کے لیے۔"
      },
      {
        h: "اسے کون دیکھ سکتا ہے",
        p: "نائل سینٹر کا وہ عملہ جسے داخلوں اور تدریس کے لیے اس کی ضرورت ہے۔ عملہ ایک محفوظ ورک اسپیس میں سائن ان کرتا ہے۔"
      },
      {
        h: "آپ کے اختیارات",
        p: "آپ ہمیں ای میل کر کے اپنی معلومات دیکھنے، درست کرنے یا حذف کرنے کی درخواست کر سکتے ہیں۔"
      }
    ],
    full: "مکمل رازداری پالیسی پڑھیں"
  },
  terms: {
    eyebrow: "شرائط",
    title: "ہمارے ساتھ تعلیم کی شرائط۔",
    lead: "مختصر خلاصہ۔ مکمل شرائط و ضوابط ہماری مرکزی سائٹ پر ہیں اور ہر اندراج پر لاگو ہوتے ہیں۔",
    sections: [
      {
        h: "لیول ٹیسٹ اور آزمائشی سبق",
        p: "لیول ٹیسٹ اور آزمائشی اسباق مفت ہیں۔ یہ آپ کو مناسب گروپ میں رکھنے میں مدد دیتے ہیں۔"
      },
      {
        h: "اندراج",
        p: "ہماری ٹیم کی جانب سے آپ کا اندراج اور ادائیگی درج ہونے کے بعد کلاس میں آپ کی جگہ پکی ہوتی ہے۔"
      },
      {
        h: "حاضری",
        p: "باقاعدہ حاضری آپ کی پیش رفت میں مدد دیتی ہے۔ استاد ہر سیشن کی حاضری درج کرتا ہے۔"
      },
      {
        h: "سرٹیفکیٹس",
        p: "سطح مکمل کرنے پر سرٹیفکیٹ جاری ہوتے ہیں، اور ہر ایک کی اس سائٹ پر تصدیق ہو سکتی ہے۔"
      }
    ],
    full: "مکمل شرائط و ضوابط پڑھیں"
  },
  notFound: {
    title: "ہمیں یہ صفحہ نہیں ملا۔",
    text: "لنک پرانا ہو سکتا ہے، یا صفحہ منتقل ہو گیا ہے۔",
    home: "ہوم پیج پر جائیں",
    programmes: "ہمارے پروگرامز دیکھیں"
  }
};

export const PUBLIC_COPY: Record<LandingLocale, PublicCopy> = { en, ar, tr, zh, ru, ur };
export const OFFICIAL_PRIVACY = "https://nilecenter.edu.eg/privacy-policy/";
export const OFFICIAL_TERMS = "https://nilecenter.edu.eg/term_conditions/";
