// Interface translations. Order of LANGS is the order of the switcher; the first is the default.

export const LANGS = [
  { code: 'en', label: 'EN', name: 'English', locale: 'en-US' },
  { code: 'az', label: 'AZ', name: 'Azərbaycanca', locale: 'az-Latn-AZ' },
  { code: 'de', label: 'DE', name: 'Deutsch', locale: 'de-DE' },
  { code: 'ru', label: 'RU', name: 'Русский', locale: 'ru-RU' },
];

const UI = {
  en: {
    pageTitle: 'Continental Drift: from Pangaea to Today',
    title: 'Continental Drift',
    subtitle: 'from Pangaea to the present day',
    loaderSub: 'Loading the Müller et al. 2019 plate model, ETOPO1 relief and NASA imagery',
    building: 'Assembling plates and relief…',
    error: 'Error',
    loadFailed: (u) => `could not load ${u}`,
    webgl2: 'This browser does not support WebGL 2',
    maAgo: 'million years ago',
    today: 'Today',
    seaLevel: 'Sea level',
    temperature: 'Temperature',
    meters: 'm',
    eventAgo: (t) => `${t} million years ago`,
    eventNow: 'present day',
    tipMa: (t) => `${t} Ma`,
    tipNow: 'now',
    periodRange: (n, a, b) => `${n}: ${a}–${b} million years ago`,
    globe: 'Globe',
    map: 'Map',
    clouds: 'Clouds',
    atmosphere: 'Atmosphere',
    labels: 'Labels',
    night: 'Day & night (city lights)',
    bounds: 'Plate boundaries',
    tectonics: 'Tectonics (uplift / subsidence)',
    tectonicsTitle: 'Tectonics',
    lgUp: 'rising: mountain building',
    lgDown: 'sinking: cooling seafloor, erosion',
    lgSub: 'subduction zone / collision',
    lgRidge: 'mid-ocean ridge / transform',
    coast: 'Present-day coastlines',
    grid: 'Coordinate grid',
    rotate: 'Rotate globe',
    relief: 'Relief',
    quality: 'Quality',
    qMedium: 'Medium',
    qHigh: 'High',
    qUltra: 'Ultra',
    keys: '<kbd>Space</kbd> play/pause · <kbd>←</kbd><kbd>→</kbd> step · <kbd>M</kbd> map · <kbd>R</kbd> restart',
    credits: 'Plate model: Müller et al. (2019), <i>Tectonics</i>. Relief: NOAA ETOPO1. Seafloor age: EarthByte. Imagery: NASA Blue Marble / Black Marble.',
    settings: 'Settings',
    restart: 'Restart (R)',
    play: 'Play / pause (Space)',
    language: 'Language',
  },
  az: {
    pageTitle: 'Kontinentlərin dreyfi: Pangeyadan bu günə qədər',
    title: 'Kontinentlərin dreyfi',
    subtitle: 'Pangeyadan bu günə qədər',
    loaderSub: 'Müller et al. 2019 plitə modeli, ETOPO1 relyefi və NASA şəkilləri yüklənir',
    building: 'Plitələr və relyef yığılır…',
    error: 'Xəta',
    loadFailed: (u) => `${u} yüklənmədi`,
    webgl2: 'Bu brauzer WebGL 2-ni dəstəkləmir',
    maAgo: 'milyon il əvvəl',
    today: 'Bu gün',
    seaLevel: 'Dəniz səviyyəsi',
    temperature: 'Temperatur',
    meters: 'm',
    eventAgo: (t) => `${t} milyon il əvvəl`,
    eventNow: 'indiki dövr',
    tipMa: (t) => `${t} mln`,
    tipNow: 'indi',
    periodRange: (n, a, b) => `${n}: ${a}–${b} milyon il əvvəl`,
    globe: 'Qlobus',
    map: 'Xəritə',
    clouds: 'Buludlar',
    atmosphere: 'Atmosfer',
    labels: 'Adlar',
    night: 'Gecə və gündüz (şəhər işıqları)',
    bounds: 'Plitə sərhədləri',
    tectonics: 'Tektonika (qalxma / enmə)',
    tectonicsTitle: 'Tektonika',
    lgUp: 'qalxma: dağəmələgəlmə',
    lgDown: 'enmə: okean dibinin soyuması, eroziya',
    lgSub: 'subduksiya zonası / toqquşma',
    lgRidge: 'okeanortası silsilə / transform',
    coast: 'Müasir sahil xətləri',
    grid: 'Koordinat şəbəkəsi',
    rotate: 'Qlobusu fırlat',
    relief: 'Relyef',
    quality: 'Keyfiyyət',
    qMedium: 'Orta',
    qHigh: 'Yüksək',
    qUltra: 'Ultra',
    keys: '<kbd>Boşluq</kbd> başlat/fasilə · <kbd>←</kbd><kbd>→</kbd> addım · <kbd>M</kbd> xəritə · <kbd>R</kbd> yenidən',
    credits: 'Plitə modeli: Müller et al. (2019), <i>Tectonics</i>. Relyef: NOAA ETOPO1. Okean dibinin yaşı: EarthByte. Şəkillər: NASA Blue Marble / Black Marble.',
    settings: 'Parametrlər',
    restart: 'Əvvələ qayıt (R)',
    play: 'Başlat / fasilə (Boşluq)',
    language: 'Dil',
  },
  de: {
    pageTitle: 'Kontinentaldrift: von Pangaea bis heute',
    title: 'Kontinentaldrift',
    subtitle: 'von Pangaea bis heute',
    loaderSub: 'Lade das Plattenmodell von Müller et al. 2019, das ETOPO1-Relief und NASA-Bilder',
    building: 'Platten und Relief werden zusammengesetzt…',
    error: 'Fehler',
    loadFailed: (u) => `${u} konnte nicht geladen werden`,
    webgl2: 'Dieser Browser unterstützt kein WebGL 2',
    maAgo: 'Mio. Jahre vor heute',
    today: 'Heute',
    seaLevel: 'Meeresspiegel',
    temperature: 'Temperatur',
    meters: 'm',
    eventAgo: (t) => `vor ${t} Millionen Jahren`,
    eventNow: 'Gegenwart',
    tipMa: (t) => `${t} Mio.`,
    tipNow: 'jetzt',
    periodRange: (n, a, b) => `${n}: vor ${a}–${b} Millionen Jahren`,
    globe: 'Globus',
    map: 'Karte',
    clouds: 'Wolken',
    atmosphere: 'Atmosphäre',
    labels: 'Beschriftungen',
    night: 'Tag und Nacht (Stadtlichter)',
    bounds: 'Plattengrenzen',
    tectonics: 'Tektonik (Hebung / Senkung)',
    tectonicsTitle: 'Tektonik',
    lgUp: 'Hebung: Gebirgsbildung',
    lgDown: 'Senkung: abkühlender Meeresboden, Erosion',
    lgSub: 'Subduktionszone / Kollision',
    lgRidge: 'Mittelozeanischer Rücken / Transformstörung',
    coast: 'Heutige Küstenlinien',
    grid: 'Koordinatennetz',
    rotate: 'Globus drehen',
    relief: 'Relief',
    quality: 'Qualität',
    qMedium: 'Mittel',
    qHigh: 'Hoch',
    qUltra: 'Ultra',
    keys: '<kbd>Leertaste</kbd> Start/Pause · <kbd>←</kbd><kbd>→</kbd> Schritt · <kbd>M</kbd> Karte · <kbd>R</kbd> Neustart',
    credits: 'Plattenmodell: Müller et al. (2019), <i>Tectonics</i>. Relief: NOAA ETOPO1. Alter des Meeresbodens: EarthByte. Bilder: NASA Blue Marble / Black Marble.',
    settings: 'Einstellungen',
    restart: 'Neustart (R)',
    play: 'Start / Pause (Leertaste)',
    language: 'Sprache',
  },
  ru: {
    pageTitle: 'Дрейф континентов: от Пангеи до наших дней',
    title: 'Дрейф континентов',
    subtitle: 'от Пангеи до наших дней',
    loaderSub: 'Загрузка модели плит Müller et al. 2019, рельефа ETOPO1 и снимков NASA',
    building: 'Собираю плиты и рельеф…',
    error: 'Ошибка',
    loadFailed: (u) => `не удалось загрузить ${u}`,
    webgl2: 'Нужен браузер с поддержкой WebGL 2',
    maAgo: 'млн лет назад',
    today: 'Сегодня',
    seaLevel: 'Уровень моря',
    temperature: 'Температура',
    meters: 'м',
    eventAgo: (t) => `${t} млн лет назад`,
    eventNow: 'наши дни',
    tipMa: (t) => `${t} млн`,
    tipNow: 'сейчас',
    periodRange: (n, a, b) => `${n}: ${a}–${b} млн лет назад`,
    globe: 'Глобус',
    map: 'Карта',
    clouds: 'Облака',
    atmosphere: 'Атмосфера',
    labels: 'Подписи',
    night: 'День и ночь (огни городов)',
    bounds: 'Границы плит',
    tectonics: 'Тектоника (подъём / опускание)',
    tectonicsTitle: 'Тектоника',
    lgUp: 'подъём: горообразование',
    lgDown: 'опускание: остывание дна, эрозия',
    lgSub: 'зона субдукции / коллизия',
    lgRidge: 'срединный хребет / трансформ',
    coast: 'Современные берега',
    grid: 'Сетка координат',
    rotate: 'Вращать глобус',
    relief: 'Рельеф',
    quality: 'Качество',
    qMedium: 'Среднее',
    qHigh: 'Высокое',
    qUltra: 'Ультра',
    keys: '<kbd>Пробел</kbd> пуск/пауза · <kbd>←</kbd><kbd>→</kbd> шаг · <kbd>M</kbd> карта · <kbd>R</kbd> заново',
    credits: 'Модель плит: Müller et al. (2019), <i>Tectonics</i>. Рельеф: NOAA ETOPO1. Возраст дна: EarthByte. Снимки: NASA Blue Marble / Black Marble.',
    settings: 'Настройки',
    restart: 'В начало (R)',
    play: 'Пуск / пауза (Пробел)',
    language: 'Язык',
  },
};

// Geological periods and epochs, keyed by id (see geo-timeline.js).
const PERIODS = {
  permian: { en: 'Permian', az: 'Perm', de: 'Perm', ru: 'Пермь' },
  triassic: { en: 'Triassic', az: 'Trias', de: 'Trias', ru: 'Триас' },
  jurassic: { en: 'Jurassic', az: 'Yura', de: 'Jura', ru: 'Юра' },
  cretaceous: { en: 'Cretaceous', az: 'Təbaşir', de: 'Kreide', ru: 'Мел' },
  paleogene: { en: 'Paleogene', az: 'Paleogen', de: 'Paläogen', ru: 'Палеоген' },
  neogene: { en: 'Neogene', az: 'Neogen', de: 'Neogen', ru: 'Неоген' },
  quaternary: { en: 'Quaternary', az: 'Dördüncü dövr', de: 'Quartär', ru: 'Четвертичный' },
};

const EPOCHS = {
  lopingian: { en: 'Lopingian', az: 'Lopinq', de: 'Lopingium', ru: 'Лопинский' },
  earlyTriassic: { en: 'Early Triassic', az: 'Erkən Trias', de: 'Untertrias', ru: 'Ранний триас' },
  middleTriassic: { en: 'Middle Triassic', az: 'Orta Trias', de: 'Mitteltrias', ru: 'Средний триас' },
  lateTriassic: { en: 'Late Triassic', az: 'Gec Trias', de: 'Obertrias', ru: 'Поздний триас' },
  earlyJurassic: { en: 'Early Jurassic', az: 'Erkən Yura', de: 'Unterjura', ru: 'Ранняя юра' },
  middleJurassic: { en: 'Middle Jurassic', az: 'Orta Yura', de: 'Mitteljura', ru: 'Средняя юра' },
  lateJurassic: { en: 'Late Jurassic', az: 'Gec Yura', de: 'Oberjura', ru: 'Поздняя юра' },
  earlyCretaceous: { en: 'Early Cretaceous', az: 'Erkən Təbaşir', de: 'Unterkreide', ru: 'Ранний мел' },
  lateCretaceous: { en: 'Late Cretaceous', az: 'Gec Təbaşir', de: 'Oberkreide', ru: 'Поздний мел' },
  paleocene: { en: 'Paleocene', az: 'Paleosen', de: 'Paläozän', ru: 'Палеоцен' },
  eocene: { en: 'Eocene', az: 'Eosen', de: 'Eozän', ru: 'Эоцен' },
  oligocene: { en: 'Oligocene', az: 'Oliqosen', de: 'Oligozän', ru: 'Олигоцен' },
  miocene: { en: 'Miocene', az: 'Miosen', de: 'Miozän', ru: 'Миоцен' },
  pliocene: { en: 'Pliocene', az: 'Pliosen', de: 'Pliozän', ru: 'Плиоцен' },
  pleistocene: { en: 'Pleistocene', az: 'Pleystosen', de: 'Pleistozän', ru: 'Плейстоцен' },
  holocene: { en: 'Holocene', az: 'Holosen', de: 'Holozän', ru: 'Голоцен' },
};

// Names on the globe: continents (ride on plates) and supercontinents / palaeo-oceans.
const PLACES = {
  na: { en: 'North America', az: 'Şimali Amerika', de: 'Nordamerika', ru: 'Северная Америка' },
  sa: { en: 'South America', az: 'Cənubi Amerika', de: 'Südamerika', ru: 'Южная Америка' },
  af: { en: 'Africa', az: 'Afrika', de: 'Afrika', ru: 'Африка' },
  eu: { en: 'Europe', az: 'Avropa', de: 'Europa', ru: 'Европа' },
  as: { en: 'Asia', az: 'Asiya', de: 'Asien', ru: 'Азия' },
  in: { en: 'India', az: 'Hindistan', de: 'Indien', ru: 'Индия' },
  au: { en: 'Australia', az: 'Avstraliya', de: 'Australien', ru: 'Австралия' },
  an: { en: 'Antarctica', az: 'Antarktida', de: 'Antarktika', ru: 'Антарктида' },
  gl: { en: 'Greenland', az: 'Qrenlandiya', de: 'Grönland', ru: 'Гренландия' },
  ar: { en: 'Arabia', az: 'Ərəbistan', de: 'Arabien', ru: 'Аравия' },
  mg: { en: 'Madagascar', az: 'Madaqaskar', de: 'Madagaskar', ru: 'Мадагаскар' },
  zl: { en: 'Zealandia', az: 'Zelandiya', de: 'Zealandia', ru: 'Зеландия' },
  pangaea: { en: 'Pangaea', az: 'Pangeya', de: 'Pangaea', ru: 'Пангея' },
  laurasia: { en: 'Laurasia', az: 'Lavraziya', de: 'Laurasia', ru: 'Лавразия' },
  gondwana: { en: 'Gondwana', az: 'Qondvana', de: 'Gondwana', ru: 'Гондвана' },
  panthalassa: { en: 'Panthalassa', az: 'Pantalassa', de: 'Panthalassa', ru: 'Панталасса' },
  tethys: { en: 'Tethys', az: 'Tetis', de: 'Tethys', ru: 'Тетис' },
  atlantic: { en: 'Atlantic Ocean', az: 'Atlantik okeanı', de: 'Atlantischer Ozean', ru: 'Атлантический океан' },
  pacific: { en: 'Pacific Ocean', az: 'Sakit okean', de: 'Pazifischer Ozean', ru: 'Тихий океан' },
  indian: { en: 'Indian Ocean', az: 'Hind okeanı', de: 'Indischer Ozean', ru: 'Индийский океан' },
};

// Key events, keyed by id (see geo-timeline.js). [title, text]
const EVENTS = {
  pangaea: {
    en: ['Pangaea', 'Almost all land is gathered into the supercontinent Pangaea, surrounded by the world ocean Panthalassa, with the Tethys Ocean cutting in from the east. The largest mass extinction in Earth’s history has only just ended.'],
    az: ['Pangeya', 'Quruluğun demək olar ki, hamısı Pangeya superkontinentində birləşib. Onu dünya okeanı Pantalassa əhatə edir, şərqdən isə içəri Tetis okeanı girir. Yer tarixinin ən böyük kütləvi qırılması təzəcə başa çatıb.'],
    de: ['Pangaea', 'Fast das gesamte Festland ist im Superkontinent Pangaea vereint. Ringsum liegt der Weltozean Panthalassa, von Osten schneidet die Tethys ein. Das größte Massenaussterben der Erdgeschichte ist gerade erst vorbei.'],
    ru: ['Пангея', 'Почти вся суша собрана в суперконтинент Пангею. Вокруг — мировой океан Панталасса, с востока в неё вдаётся залив-океан Тетис. Недавно закончилось крупнейшее массовое вымирание в истории Земли.'],
  },
  mountains: {
    en: ['Central Pangean Mountains', 'In the heart of Pangaea stand mountains as high as the Himalayas: the future Appalachians, the Atlas and the ranges of Europe. The supercontinent’s interior is a vast, hot desert.'],
    az: ['Mərkəzi Pangeya dağları', 'Pangeyanın mərkəzində Himalay boyda dağlar ucalır: gələcək Appalaç, Atlas və Avropa dağları. Superkontinentin daxili hissəsi nəhəng isti səhralardır.'],
    de: ['Zentralpangäisches Gebirge', 'Im Herzen Pangaeas erheben sich Berge so hoch wie der Himalaya: die künftigen Appalachen, der Atlas und die Gebirge Europas. Das Innere des Superkontinents ist eine riesige heiße Wüste.'],
    ru: ['Центрально-Пангейские горы', 'В сердце Пангеи стоят горы высотой с Гималаи, будущие Аппалачи, Атлас и горы Европы. Внутренние районы суперконтинента — огромные жаркие пустыни.'],
  },
  rifting: {
    en: ['Pangaea breaks apart', 'Rifting begins between North America and Africa. Huge outpourings of lava from the Central Atlantic Magmatic Province coincide with the end-Triassic mass extinction.'],
    az: ['Pangeya parçalanır', 'Şimali Amerika ilə Afrika arasında rifləşmə başlayır. Mərkəzi Atlantik maqmatik əyalətinin nəhəng lava axınları Trias–Yura kütləvi qırılması ilə üst-üstə düşür.'],
    de: ['Pangaea zerbricht', 'Zwischen Nordamerika und Afrika reißt die Kruste auf. Gewaltige Lavaergüsse der Zentralatlantischen Magmatischen Provinz fallen mit dem Massenaussterben an der Trias-Jura-Grenze zusammen.'],
    ru: ['Пангея раскалывается', 'Между Северной Америкой и Африкой начинается рифтинг. Мощные излияния лав Центрально-Атлантической провинции совпадают с триасово-юрским вымиранием.'],
  },
  atlantic: {
    en: ['Birth of the Atlantic', 'The Central Atlantic opens. Gondwana (the southern continents) begins to separate from Laurasia (the northern ones).'],
    az: ['Atlantikanın doğuluşu', 'Mərkəzi Atlantika açılır. Qondvana (cənub materikləri) Lavraziyadan (şimal materiklərindən) ayrılmağa başlayır.'],
    de: ['Geburt des Atlantiks', 'Der Zentralatlantik öffnet sich. Gondwana (die Südkontinente) beginnt sich von Laurasia (den Nordkontinenten) zu trennen.'],
    ru: ['Рождение Атлантики', 'Открывается Центральная Атлантика. Гондвана (южные континенты) начинает отделяться от Лавразии (северных).'],
  },
  gondwana: {
    en: ['Gondwana breaks up', 'East Gondwana (Antarctica, India, Australia) pulls away from Africa. New seafloor appears, with mid-ocean ridges running along its centre.'],
    az: ['Qondvananın dağılması', 'Şərqi Qondvana (Antarktida, Hindistan, Avstraliya) Afrikadan uzaqlaşır. Yeni okean dibi yaranır, onun ortası boyunca isə okeanortası silsilələr uzanır.'],
    de: ['Gondwana zerfällt', 'Ostgondwana (Antarktika, Indien, Australien) löst sich von Afrika. Neuer Meeresboden entsteht, in seiner Mitte verlaufen mittelozeanische Rücken.'],
    ru: ['Распад Гондваны', 'Восточная Гондвана (Антарктида, Индия, Австралия) отходит от Африки. Появляется молодое морское дно, а по его центру — срединно-океанические хребты.'],
  },
  southAtlantic: {
    en: ['The South Atlantic opens', 'South America tears away from Africa, and the South Atlantic “unzips” between them from south to north.'],
    az: ['Cənubi Atlantika açılır', 'Cənubi Amerika Afrikadan qopur və onların arasında Cənubi Atlantika cənubdan şimala doğru «fermuar kimi» açılır.'],
    de: ['Der Südatlantik öffnet sich', 'Südamerika reißt sich von Afrika los, und zwischen beiden öffnet sich der Südatlantik wie ein Reißverschluss von Süden nach Norden.'],
    ru: ['Открывается Южная Атлантика', 'Южная Америка отрывается от Африки, и между ними с юга на север «расстёгивается» Южная Атлантика.'],
  },
  india: {
    en: ['India heads north', 'India splits from Antarctica and Australia and begins its drift north across the Tethys Ocean. It will become one of the fastest plates in Earth’s history.'],
    az: ['Hindistan şimala yollanır', 'Hindistan Antarktida və Avstraliyadan ayrılır və Tetis okeanı boyunca şimala doğru dreyfə başlayır. Sonralar o, Yer tarixinin ən sürətli plitələrindən birinə çevriləcək.'],
    de: ['Indien driftet nach Norden', 'Indien trennt sich von Antarktika und Australien und beginnt seine Reise nach Norden durch die Tethys. Später wird es zu einer der schnellsten Platten der Erdgeschichte.'],
    ru: ['Индия уходит на север', 'Индия отделяется от Антарктиды и Австралии и начинает дрейф на север через океан Тетис. Позже она станет одной из самых быстрых плит в истории.'],
  },
  seaLevel: {
    en: ['Peak sea level', 'The Cretaceous greenhouse: no ice at the poles, the ocean stands more than 200 m higher than today, and shallow seas flood the continents. The Western Interior Seaway splits North America in two.'],
    az: ['Dəniz səviyyəsinin zirvəsi', 'Təbaşir dövrünün «istixana» iqlimi: qütblərdə buz yoxdur, okean bugünkündən 200 m-dən çox yüksəkdir və dayaz dənizlər materikləri basır. Qərbi Daxili dəniz yolu Şimali Amerikanı ikiyə bölür.'],
    de: ['Höchster Meeresspiegel', 'Das Treibhausklima der Kreide: kein Eis an den Polen, der Ozean steht über 200 m höher als heute, und Flachmeere überfluten die Kontinente. Der Western Interior Seaway teilt Nordamerika in zwei Hälften.'],
    ru: ['Максимум уровня моря', 'Меловой «тепличный» климат. Льда на полюсах нет, уровень океана на 200+ м выше сегодняшнего, и мелкие моря заливают континенты. Северную Америку делит Западный внутренний морской путь.'],
  },
  madagascar: {
    en: ['Madagascar parts from India', 'India and Madagascar go their separate ways. Madagascar stays beside Africa and has followed its own evolutionary path ever since.'],
    az: ['Madaqaskar Hindistandan ayrılır', 'Hindistan və Madaqaskar ayrılır. Madaqaskar Afrikanın yanında qalır və o vaxtdan bəri öz təkamül yolu ilə gedir.'],
    de: ['Madagaskar trennt sich von Indien', 'Indien und Madagaskar gehen getrennte Wege. Madagaskar bleibt bei Afrika und geht seitdem seinen eigenen evolutionären Weg.'],
    ru: ['Мадагаскар отделяется от Индии', 'Индия и Мадагаскар расходятся. Мадагаскар остаётся у Африки, где живёт своей эволюционной историей до сих пор.'],
  },
  dinosaurs: {
    en: ['The end of the dinosaurs', 'The Chicxulub asteroid strikes off the Yucatán coast while the Deccan Traps erupt in India. The non-avian dinosaurs die out.'],
    az: ['Dinozavrlar erasının sonu', 'Yukatan sahillərinə Çiksulub asteroidi düşür, Hindistanda Dekan trappları püskürür. Quş olmayan dinozavrların nəsli kəsilir.'],
    de: ['Das Ende der Dinosaurier', 'Vor Yucatán schlägt der Chicxulub-Asteroid ein, in Indien brechen die Dekkan-Trapps aus. Die Nicht-Vogel-Dinosaurier sterben aus.'],
    ru: ['Конец эры динозавров', 'У побережья Юкатана падает астероид Чиксулуб, в Индии извергаются Деканские траппы. Нептичьи динозавры вымирают.'],
  },
  himalaya: {
    en: ['India crashes into Asia', 'India begins to collide with Eurasia. The crust buckles, and the Himalayas and the Tibetan Plateau rise: the highest mountains on the planet.'],
    az: ['Hindistan Asiyaya çırpılır', 'Hindistanın Avrasiya ilə toqquşması başlayır. Yer qabığı əzilir və planetin ən hündür dağları olan Himalay və Tibet yaylası yüksəlir.'],
    de: ['Indien kollidiert mit Asien', 'Indien beginnt mit Eurasien zu kollidieren. Die Kruste staucht sich, und der Himalaya und das Tibetische Hochland wachsen, die höchsten Gebirge der Erde.'],
    ru: ['Индия врезается в Азию', 'Начинается столкновение Индии с Евразией. Кора сминается, и растут Гималаи и Тибетское нагорье, самые высокие горы планеты.'],
  },
  australia: {
    en: ['Australia leaves Antarctica', 'Australia breaks away from Antarctica and moves north. The Drake Passage will soon open.'],
    az: ['Avstraliya Antarktidadan ayrılır', 'Avstraliya Antarktidadan qopub şimala doğru hərəkət edir. Tezliklə Dreyk keçidi açılacaq.'],
    de: ['Australien löst sich von Antarktika', 'Australien trennt sich von Antarktika und wandert nach Norden. Bald öffnet sich die Drakestraße.'],
    ru: ['Австралия уходит от Антарктиды', 'Австралия отделяется от Антарктиды и движется на север. Вскоре откроется пролив Дрейка.'],
  },
  antarcticIce: {
    en: ['Antarctica ices over', 'A circumpolar current forms around Antarctica and cuts the continent off from warm waters. An ice sheet grows, and Earth’s climate switches into “icehouse” mode.'],
    az: ['Antarktida buzla örtülür', 'Antarktida ətrafında sirkumpolyar axın yaranır və materiki isti sulardan təcrid edir. Buz örtüyü əmələ gəlir və Yer iqlimi «soyuducu» rejiminə keçir.'],
    de: ['Antarktika vereist', 'Um Antarktika bildet sich ein zirkumpolarer Strom, der den Kontinent von warmem Wasser abschirmt. Ein Eisschild wächst, und das Klima der Erde wechselt in den Eishaus-Modus.'],
    ru: ['Антарктида покрывается льдом', 'Вокруг Антарктиды формируется циркумполярное течение, континент изолируется от тёплых вод. Возникает ледяной щит, и климат Земли переходит в «холодильник».'],
  },
  alps: {
    en: ['The Alps rise', 'Africa pushes into Europe, raising the Alps, the Pyrenees and the Carpathians. The Tethys gradually closes; its remnant is the Mediterranean Sea.'],
    az: ['Alp dağları yüksəlir', 'Afrika Avropaya sıxılır, Alp, Pireney və Karpat dağları qalxır. Tetis tədricən bağlanır, ondan qalan hissə Aralıq dənizidir.'],
    de: ['Die Alpen entstehen', 'Afrika drängt gegen Europa, Alpen, Pyrenäen und Karpaten falten sich auf. Die Tethys schließt sich allmählich, ihr Rest ist das Mittelmeer.'],
    ru: ['Растут Альпы', 'Африка напирает на Европу, поднимаются Альпы, Пиренеи и Карпаты. Тетис постепенно замыкается, остаток — Средиземное море.'],
  },
  arabia: {
    en: ['Arabia meets Eurasia', 'The Red Sea opens as Arabia tears away from Africa and crumples the Zagros. The Andes rise rapidly above the subduction zone.'],
    az: ['Ərəbistan Avrasiya ilə toqquşur', 'Qırmızı dəniz açılır: Ərəbistan Afrikadan qopur və Zaqros dağlarını əzir. And dağları subduksiya zonası üzərində sürətlə yüksəlir.'],
    de: ['Arabien stößt auf Eurasien', 'Das Rote Meer öffnet sich, Arabien löst sich von Afrika und faltet das Zagros-Gebirge auf. Die Anden steigen über der Subduktionszone rasch empor.'],
    ru: ['Аравия сталкивается с Евразией', 'Раскрывается Красное море. Аравия отрывается от Африки и сминает Загрос. Анды быстро растут над зоной субдукции.'],
  },
  zanclean: {
    en: ['The Zanclean flood', 'The Atlantic breaks through at Gibraltar and refills the dried-out Mediterranean within just a few years.'],
    az: ['Zankl daşqını', 'Atlantik okeanı Cəbəllütariqdən yarıb keçir və qurumuş Aralıq dənizini cəmi bir neçə il ərzində yenidən doldurur.'],
    de: ['Die Zancleanische Flut', 'Der Atlantik bricht bei Gibraltar durch und füllt das ausgetrocknete Mittelmeer binnen weniger Jahre wieder auf.'],
    ru: ['Занклийский потоп', 'Атлантика прорывается через Гибралтар и за считанные годы заново наполняет пересохшее Средиземное море.'],
  },
  panama: {
    en: ['The Isthmus of Panama', 'North and South America join. Ocean currents shift, ice sheets spread across the Northern Hemisphere and Greenland disappears under ice.'],
    az: ['Panama bərzəxi', 'Şimali və Cənubi Amerika birləşir. Okean axınları dəyişir, Şimal yarımkürəsi buzlaqlarla örtülür, Qrenlandiya buz altında qalır.'],
    de: ['Die Landenge von Panama', 'Nord- und Südamerika verbinden sich. Die Meeresströmungen ändern sich, die Nordhalbkugel vergletschert, und Grönland verschwindet unter dem Eis.'],
    ru: ['Панамский перешеек', 'Северная и Южная Америка соединяются. Меняются течения, и Северное полушарие покрывается ледниками. Гренландия уходит под лёд.'],
  },
  today: {
    en: ['Today', 'Seven continents, five oceans and ice caps at both poles. The plates keep moving about as fast as fingernails grow, 2–10 cm a year.'],
    az: ['Bu gün', 'Yeddi materik, beş okean, qütblərdə buz örtükləri. Plitələr hələ də dırnaqlarımızın uzanma sürəti ilə, ildə 2–10 sm hərəkət edir.'],
    de: ['Heute', 'Sieben Kontinente, fünf Ozeane und Eiskappen an beiden Polen. Die Platten bewegen sich weiter, etwa so schnell, wie Fingernägel wachsen: 2–10 cm pro Jahr.'],
    ru: ['Сегодня', 'Семь континентов, пять океанов, ледяные шапки на полюсах. Плиты продолжают двигаться со скоростью роста ногтей, 2–10 см в год.'],
  },
};

// Exposed for the completeness tests.
export const DICTIONARIES = { UI, PERIODS, EPOCHS, PLACES, EVENTS };

const STORAGE_KEY = 'pangaea-drift-lang';
let current = LANGS[0].code;
const listeners = new Set();

function initialLang() {
  const fromUrl = new URLSearchParams(window.location.search).get('lang');
  if (fromUrl && UI[fromUrl]) return fromUrl;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && UI[saved]) return saved;
  } catch {
    // storage unavailable (private mode etc.) — fall back to the default
  }
  return LANGS[0].code;
}

current = initialLang();

export const getLang = () => current;

export function setLang(code) {
  if (!UI[code] || code === current) return;
  current = code;
  try {
    window.localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // ignore
  }
  const url = new URL(window.location.href);
  url.searchParams.set('lang', code);
  window.history.replaceState(null, '', url);
  for (const fn of listeners) fn(code);
}

export const onLangChange = (fn) => listeners.add(fn);

export const t = (key) => UI[current][key] ?? UI.en[key] ?? key;
export const periodName = (id) => PERIODS[id]?.[current] ?? id;
export const epochName = (id) => EPOCHS[id]?.[current] ?? id;
export const placeName = (id) => PLACES[id]?.[current] ?? id;
export const eventText = (id) => EVENTS[id]?.[current] ?? EVENTS[id]?.en;

// Number formatting in the active locale (decimal comma in az/de/ru).
// (Explicit separator: not every browser ships ICU data for az.)
export const fmt = (x, digits = 0) => {
  const s = x.toFixed(digits);
  return current === 'en' ? s : s.replace('.', ',');
};

// Apply translations to static markup: data-i18n (text), data-i18n-html, data-i18n-title.
export function translateDom(root = document) {
  document.documentElement.lang = current;
  document.title = t('pageTitle');
  root.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n)));
  root.querySelectorAll('[data-i18n-html]').forEach((el) => (el.innerHTML = t(el.dataset.i18nHtml)));
  root.querySelectorAll('[data-i18n-title]').forEach((el) => {
    el.title = t(el.dataset.i18nTitle);
    el.setAttribute('aria-label', t(el.dataset.i18nTitle));
  });
}
