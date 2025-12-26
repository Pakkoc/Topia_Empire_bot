import {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ComponentType,
  type ButtonInteraction,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
} from 'discord.js';
import type { MarketListing, MarketCategory, MarketService, CurrencyService } from '@topia/core';
import { CATEGORY_LABELS, STATUS_LABELS } from '@topia/core';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

const ITEMS_PER_PAGE = 5;

/** 카테고리 선택 옵션 */
const CATEGORY_OPTIONS = [
  { label: '전체', value: 'all', emoji: '🔷' },
  { label: '디자인', value: 'design', emoji: '🎨' },
  { label: '음악', value: 'music', emoji: '🎵' },
  { label: '영상', value: 'video', emoji: '🎬' },
  { label: '코딩', value: 'coding', emoji: '💻' },
  { label: '기타', value: 'other', emoji: '✨' },
];

/** 화폐 선택 옵션 생성 */
function getCurrencyOptions(topyName: string, rubyName: string) {
  return [
    { label: '전체', value: 'all', emoji: '🔷' },
    { label: topyName, value: 'topy', emoji: '💰' },
    { label: rubyName, value: 'ruby', emoji: '💎' },
  ];
}

interface Container {
  marketService: MarketService;
  currencyService: CurrencyService;
}

// ============================================================
// 헬퍼 함수들
// ============================================================

/** 장터 목록 Embed 생성 */
function createMarketEmbed(
  listings: MarketListing[],
  topyName: string,
  rubyName: string,
  page: number,
  totalCount: number
): EmbedBuilder {
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);
  const startIdx = page * ITEMS_PER_PAGE;

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🛒 장터 목록')
    .setTimestamp();

  if (listings.length === 0) {
    embed.setDescription('현재 판매 중인 상품이 없습니다.\n\n상품을 등록하려면 패널의 **등록하기** 버튼을 클릭하세요.');
  } else {
    embed.setDescription(`📦 판매 중인 상품 (${totalCount}개)\n\n아래 메뉴에서 구매할 상품을 선택하세요.`);

    const fields = listings.map((listing, idx) => {
      const currencyName = listing.currencyType === 'topy' ? topyName : rubyName;
      const currencyEmoji = listing.currencyType === 'topy' ? '💰' : '💎';
      const categoryLabel = CATEGORY_LABELS[listing.category];
      const expiresIn = formatDistanceToNow(listing.expiresAt, { locale: ko, addSuffix: true });

      return {
        name: `${startIdx + idx + 1}. ${listing.title}`,
        value: `${categoryLabel} | ${currencyEmoji} **${listing.price.toLocaleString()}** ${currencyName}\n판매자: <@${listing.sellerId}> · 만료 ${expiresIn}`,
        inline: false,
      };
    });

    embed.addFields(fields);
  }

  if (totalPages > 1) {
    embed.setFooter({ text: `페이지 ${page + 1}/${totalPages}` });
  }

  return embed;
}

/** 상품 선택 메뉴 생성 */
function createListingSelectMenu(
  listings: MarketListing[],
  topyName: string,
  rubyName: string,
  customId: string
): StringSelectMenuBuilder {
  const options = listings.slice(0, 25).map((listing) => {
    const currencyName = listing.currencyType === 'topy' ? topyName : rubyName;
    const categoryEmoji = CATEGORY_LABELS[listing.category].split(' ')[0];

    return {
      label: listing.title.length > 50 ? listing.title.slice(0, 47) + '...' : listing.title,
      description: `${listing.price.toLocaleString()} ${currencyName}`,
      value: listing.id.toString(),
      emoji: categoryEmoji,
    };
  });

  return new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder('구매할 상품을 선택하세요')
    .addOptions(options);
}

/** 등록 모달 생성 */
function createRegisterModal(uniqueId: string): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(`market_panel_register_modal_${uniqueId}`)
    .setTitle('🛒 장터 상품 등록');

  const titleInput = new TextInputBuilder()
    .setCustomId('title')
    .setLabel('상품 제목')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('예: 프로필 디자인 해드립니다')
    .setMaxLength(200)
    .setRequired(true);

  const descriptionInput = new TextInputBuilder()
    .setCustomId('description')
    .setLabel('상품 설명')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('상품에 대한 설명을 입력하세요')
    .setMaxLength(1000)
    .setRequired(false);

  const priceInput = new TextInputBuilder()
    .setCustomId('price')
    .setLabel('가격 (숫자만 입력)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('예: 5000')
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(descriptionInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(priceInput)
  );

  return modal;
}

// ============================================================
// 버튼 핸들러
// ============================================================

/** 목록보기 버튼 핸들러 */
export async function handleMarketPanelList(
  interaction: ButtonInteraction,
  container: Container
) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  if (!guildId) {
    await interaction.reply({ content: '서버에서만 사용할 수 있습니다.', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  // 화폐 설정 조회
  const settingsResult = await container.currencyService.getSettings(guildId);
  const topyName = (settingsResult.success && settingsResult.data?.topyName) || '토피';
  const rubyName = (settingsResult.success && settingsResult.data?.rubyName) || '루비';

  let currentPage = 0;
  let currentCategory: MarketCategory | undefined;
  let currentCurrency: 'topy' | 'ruby' | undefined;

  const fetchListings = async () => {
    const [listingsResult, countResult] = await Promise.all([
      container.marketService.getListings(guildId, {
        category: currentCategory,
        currencyType: currentCurrency,
        status: 'active',
        limit: ITEMS_PER_PAGE,
        offset: currentPage * ITEMS_PER_PAGE,
      }),
      container.marketService.getActiveListingsCount(guildId, {
        category: currentCategory,
        currencyType: currentCurrency,
      }),
    ]);

    return {
      listings: listingsResult.success ? listingsResult.data : [],
      totalCount: countResult.success ? countResult.data : 0,
    };
  };

  const { listings, totalCount } = await fetchListings();
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const embed = createMarketEmbed(listings, topyName, rubyName, currentPage, totalCount);

  // 컴포넌트 생성
  const components: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] = [];

  // 필터 드롭다운
  components.push(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`market_panel_list_category_${userId}`)
        .setPlaceholder('카테고리 필터')
        .addOptions(CATEGORY_OPTIONS)
    )
  );
  components.push(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`market_panel_list_currency_${userId}`)
        .setPlaceholder('화폐 필터')
        .addOptions(getCurrencyOptions(topyName, rubyName))
    )
  );

  // 상품 선택 드롭다운 (상품이 있을 때만)
  if (listings.length > 0) {
    components.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        createListingSelectMenu(listings, topyName, rubyName, `market_panel_list_select_${userId}`)
      )
    );
  }

  // 페이지네이션 버튼
  components.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`market_panel_list_prev_${userId}`)
        .setLabel('◀ 이전')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage === 0),
      new ButtonBuilder()
        .setCustomId(`market_panel_list_next_${userId}`)
        .setLabel('다음 ▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(totalPages <= 1 || currentPage >= totalPages - 1),
      new ButtonBuilder()
        .setCustomId(`market_panel_list_refresh_${userId}`)
        .setLabel('🔄 새로고침')
        .setStyle(ButtonStyle.Primary)
    )
  );

  const response = await interaction.editReply({ embeds: [embed], components });

  // Collector로 상호작용 처리
  const collector = response.createMessageComponentCollector({
    filter: (i) => i.user.id === userId,
    time: 300000, // 5분
  });

  collector.on('collect', async (componentInteraction) => {
    // 카테고리 필터
    if (componentInteraction.customId === `market_panel_list_category_${userId}` && componentInteraction.isStringSelectMenu()) {
      currentCategory = componentInteraction.values[0] === 'all' ? undefined : (componentInteraction.values[0] as MarketCategory);
      currentPage = 0;
    }

    // 화폐 필터
    if (componentInteraction.customId === `market_panel_list_currency_${userId}` && componentInteraction.isStringSelectMenu()) {
      currentCurrency = componentInteraction.values[0] === 'all' ? undefined : (componentInteraction.values[0] as 'topy' | 'ruby');
      currentPage = 0;
    }

    // 페이지네이션
    if (componentInteraction.customId === `market_panel_list_prev_${userId}`) {
      currentPage = Math.max(0, currentPage - 1);
    }
    if (componentInteraction.customId === `market_panel_list_next_${userId}`) {
      currentPage++;
    }

    // 새로고침
    if (componentInteraction.customId === `market_panel_list_refresh_${userId}`) {
      // 필터 유지, 페이지만 새로고침
    }

    // 상품 선택 (구매)
    if (componentInteraction.customId === `market_panel_list_select_${userId}` && componentInteraction.isStringSelectMenu()) {
      await handlePurchase(componentInteraction, container, topyName, rubyName);
      return;
    }

    // 목록 새로고침
    await componentInteraction.deferUpdate();

    const { listings: newListings, totalCount: newTotalCount } = await fetchListings();
    const newTotalPages = Math.ceil(newTotalCount / ITEMS_PER_PAGE);

    const newEmbed = createMarketEmbed(newListings, topyName, rubyName, currentPage, newTotalCount);

    const newComponents: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] = [];

    newComponents.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`market_panel_list_category_${userId}`)
          .setPlaceholder('카테고리 필터')
          .addOptions(CATEGORY_OPTIONS)
      )
    );
    newComponents.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`market_panel_list_currency_${userId}`)
          .setPlaceholder('화폐 필터')
          .addOptions(getCurrencyOptions(topyName, rubyName))
      )
    );

    if (newListings.length > 0) {
      newComponents.push(
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          createListingSelectMenu(newListings, topyName, rubyName, `market_panel_list_select_${userId}`)
        )
      );
    }

    newComponents.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`market_panel_list_prev_${userId}`)
          .setLabel('◀ 이전')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentPage === 0),
        new ButtonBuilder()
          .setCustomId(`market_panel_list_next_${userId}`)
          .setLabel('다음 ▶')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(newTotalPages <= 1 || currentPage >= newTotalPages - 1),
        new ButtonBuilder()
          .setCustomId(`market_panel_list_refresh_${userId}`)
          .setLabel('🔄 새로고침')
          .setStyle(ButtonStyle.Primary)
      )
    );

    await componentInteraction.editReply({ embeds: [newEmbed], components: newComponents });
  });

  collector.on('end', async () => {
    try {
      await interaction.editReply({ components: [] });
    } catch {
      // 메시지 삭제됨
    }
  });
}

/** 구매 처리 */
async function handlePurchase(
  interaction: StringSelectMenuInteraction,
  container: Container,
  topyName: string,
  rubyName: string
) {
  const guildId = interaction.guildId!;
  const userId = interaction.user.id;
  const listingId = BigInt(interaction.values[0]!);

  // 상품 상세 정보 조회
  const listingResult = await container.marketService.getListing(listingId);

  if (!listingResult.success || !listingResult.data) {
    await interaction.reply({ content: '상품을 찾을 수 없습니다.', ephemeral: true });
    return;
  }

  const listing = listingResult.data;
  const currencyName = listing.currencyType === 'topy' ? topyName : rubyName;
  const feePercent = listing.currencyType === 'topy' ? 5 : 3;

  const detailEmbed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`📦 ${listing.title}`)
    .setDescription(listing.description || '설명 없음')
    .addFields(
      { name: '판매자', value: `<@${listing.sellerId}>`, inline: true },
      { name: '카테고리', value: CATEGORY_LABELS[listing.category], inline: true },
      { name: '가격', value: `**${listing.price.toLocaleString()}** ${currencyName}`, inline: true },
      { name: '만료일', value: formatDistanceToNow(listing.expiresAt, { locale: ko, addSuffix: true }), inline: true }
    )
    .setFooter({ text: `수수료 ${feePercent}%는 판매자가 부담합니다.` })
    .setTimestamp();

  const confirmRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`market_panel_buy_confirm_${listingId}_${userId}`)
      .setLabel('구매하기')
      .setStyle(ButtonStyle.Success)
      .setEmoji('✅'),
    new ButtonBuilder()
      .setCustomId(`market_panel_buy_cancel_${userId}`)
      .setLabel('취소')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('❌')
  );

  await interaction.reply({ embeds: [detailEmbed], components: [confirmRow], ephemeral: true });

  try {
    const buttonInteraction = await interaction.channel?.awaitMessageComponent({
      componentType: ComponentType.Button,
      filter: (i) =>
        i.user.id === userId &&
        (i.customId === `market_panel_buy_confirm_${listingId}_${userId}` ||
          i.customId === `market_panel_buy_cancel_${userId}`),
      time: 30000,
    });

    if (!buttonInteraction) return;

    if (buttonInteraction.customId === `market_panel_buy_cancel_${userId}`) {
      await buttonInteraction.update({
        embeds: [new EmbedBuilder().setColor(0x808080).setTitle('❌ 구매 취소').setDescription('구매가 취소되었습니다.')],
        components: [],
      });
      return;
    }

    await buttonInteraction.deferUpdate();

    const purchaseResult = await container.marketService.purchaseListing(guildId, userId, listingId);

    if (!purchaseResult.success) {
      let errorMessage = '구매 처리 중 오류가 발생했습니다.';

      switch (purchaseResult.error.type) {
        case 'LISTING_NOT_FOUND':
          errorMessage = '상품을 찾을 수 없습니다.';
          break;
        case 'LISTING_NOT_ACTIVE':
          errorMessage = '이미 판매된 상품입니다.';
          break;
        case 'LISTING_EXPIRED':
          errorMessage = '만료된 상품입니다.';
          break;
        case 'CANNOT_BUY_OWN_LISTING':
          errorMessage = '자신의 상품은 구매할 수 없습니다.';
          break;
        case 'INSUFFICIENT_BALANCE':
          errorMessage = `잔액이 부족합니다.\n필요: ${purchaseResult.error.required.toLocaleString()} ${currencyName}\n보유: ${purchaseResult.error.available.toLocaleString()} ${currencyName}`;
          break;
      }

      await buttonInteraction.editReply({
        embeds: [new EmbedBuilder().setColor(0xFF0000).setTitle('❌ 구매 실패').setDescription(errorMessage)],
        components: [],
      });
      return;
    }

    const { price, fee: actualFee, sellerReceived, buyerNewBalance } = purchaseResult.data;

    const successEmbed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('✅ 구매 완료!')
      .setDescription(`**${listing.title}**을(를) 구매했습니다.`)
      .addFields(
        { name: '💰 지불 금액', value: `${price.toLocaleString()} ${currencyName}`, inline: true },
        { name: '💵 남은 잔액', value: `${buyerNewBalance.toLocaleString()} ${currencyName}`, inline: true }
      )
      .addFields({
        name: '📝 안내',
        value: `판매자 <@${listing.sellerId}>님에게 DM으로 연락하여 서비스를 받으세요.\n분쟁 발생 시 관리자에게 문의하세요.`,
      })
      .setTimestamp();

    await buttonInteraction.editReply({ embeds: [successEmbed], components: [] });

    // 판매자에게 DM 알림
    try {
      const seller = await interaction.client.users.fetch(listing.sellerId);
      const sellerEmbed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('💰 장터 판매 알림!')
        .setDescription(`<@${userId}>님이 상품을 구매했습니다.`)
        .addFields(
          { name: '📦 상품', value: listing.title, inline: false },
          { name: '💰 판매 금액', value: `${price.toLocaleString()} ${currencyName}`, inline: true },
          { name: '📋 수수료', value: `${actualFee.toLocaleString()} ${currencyName}`, inline: true },
          { name: '💵 실수령액', value: `${sellerReceived.toLocaleString()} ${currencyName}`, inline: true }
        )
        .setFooter({ text: '구매자에게 DM으로 서비스를 제공해주세요.' })
        .setTimestamp();

      await seller.send({ embeds: [sellerEmbed] });
    } catch {
      // DM 전송 실패 무시
    }
  } catch {
    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(0x808080).setTitle('⏰ 시간 초과').setDescription('구매 확인 시간이 초과되었습니다.')],
      components: [],
    });
  }
}

/** 등록하기 버튼 핸들러 */
export async function handleMarketPanelRegister(
  interaction: ButtonInteraction,
  container: Container
) {
  const userId = interaction.user.id;
  const uniqueId = `${userId}_${Date.now()}`;

  const modal = createRegisterModal(uniqueId);
  await interaction.showModal(modal);
}

/** 등록 모달 제출 핸들러 */
export async function handleMarketPanelRegisterModal(
  interaction: ModalSubmitInteraction,
  container: Container
) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  if (!guildId) {
    await interaction.reply({ content: '서버에서만 사용할 수 있습니다.', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  // 화폐 설정 조회
  const settingsResult = await container.currencyService.getSettings(guildId);
  const topyName = (settingsResult.success && settingsResult.data?.topyName) || '토피';
  const rubyName = (settingsResult.success && settingsResult.data?.rubyName) || '루비';

  const title = interaction.fields.getTextInputValue('title');
  const description = interaction.fields.getTextInputValue('description') || undefined;
  const priceStr = interaction.fields.getTextInputValue('price');

  // 가격 파싱
  const price = BigInt(priceStr.replace(/[^0-9]/g, '') || '0');

  if (price <= BigInt(0)) {
    await interaction.editReply({ content: '❌ 유효한 가격을 입력해주세요.' });
    return;
  }

  // 카테고리 & 화폐 선택 UI
  const categorySelect = new StringSelectMenuBuilder()
    .setCustomId(`market_panel_reg_category_${userId}`)
    .setPlaceholder('카테고리 선택')
    .addOptions(CATEGORY_OPTIONS.filter((opt) => opt.value !== 'all'));

  const currencySelect = new StringSelectMenuBuilder()
    .setCustomId(`market_panel_reg_currency_${userId}`)
    .setPlaceholder('화폐 선택')
    .addOptions([
      { label: topyName, value: 'topy', emoji: '💰', description: '최소 100' },
      { label: rubyName, value: 'ruby', emoji: '💎', description: '최소 1' },
    ]);

  const previewEmbed = new EmbedBuilder()
    .setColor(0xFFA500)
    .setTitle('📝 상품 등록 미리보기')
    .addFields(
      { name: '제목', value: title, inline: false },
      { name: '설명', value: description || '(없음)', inline: false },
      { name: '가격', value: price.toLocaleString(), inline: true },
      { name: '카테고리', value: '선택해주세요', inline: true },
      { name: '화폐', value: '선택해주세요', inline: true }
    )
    .setFooter({ text: '카테고리와 화폐를 선택한 후 등록하기를 눌러주세요.' });

  const response = await interaction.editReply({
    embeds: [previewEmbed],
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(categorySelect),
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(currencySelect),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`market_panel_reg_confirm_${userId}`)
          .setLabel('등록하기')
          .setStyle(ButtonStyle.Success)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId(`market_panel_reg_cancel_${userId}`)
          .setLabel('취소')
          .setStyle(ButtonStyle.Secondary)
      ),
    ],
  });

  let selectedCategory: MarketCategory | undefined;
  let selectedCurrency: 'topy' | 'ruby' | undefined;

  const collector = response.createMessageComponentCollector({
    filter: (i) => i.user.id === userId,
    time: 120000,
  });

  collector.on('collect', async (componentInteraction) => {
    if (componentInteraction.customId === `market_panel_reg_cancel_${userId}`) {
      await componentInteraction.update({
        embeds: [new EmbedBuilder().setColor(0x808080).setTitle('❌ 등록 취소').setDescription('상품 등록이 취소되었습니다.')],
        components: [],
      });
      collector.stop();
      return;
    }

    if (componentInteraction.customId === `market_panel_reg_category_${userId}` && componentInteraction.isStringSelectMenu()) {
      selectedCategory = componentInteraction.values[0] as MarketCategory;
    }

    if (componentInteraction.customId === `market_panel_reg_currency_${userId}` && componentInteraction.isStringSelectMenu()) {
      selectedCurrency = componentInteraction.values[0] as 'topy' | 'ruby';
    }

    if (componentInteraction.customId === `market_panel_reg_confirm_${userId}`) {
      if (!selectedCategory || !selectedCurrency) {
        await componentInteraction.reply({ content: '❌ 카테고리와 화폐를 모두 선택해주세요.', ephemeral: true });
        return;
      }

      await componentInteraction.deferUpdate();

      const minPrice = selectedCurrency === 'topy' ? BigInt(100) : BigInt(1);
      if (price < minPrice) {
        await componentInteraction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xFF0000)
              .setTitle('❌ 등록 실패')
              .setDescription(`최소 가격은 ${minPrice.toLocaleString()} ${selectedCurrency === 'topy' ? topyName : rubyName}입니다.`),
          ],
          components: [],
        });
        collector.stop();
        return;
      }

      const createResult = await container.marketService.createListing({
        guildId,
        sellerId: userId,
        title,
        description,
        category: selectedCategory,
        price,
        currencyType: selectedCurrency,
      });

      if (!createResult.success) {
        let errorMessage = '상품 등록 중 오류가 발생했습니다.';

        if (createResult.error.type === 'MAX_LISTINGS_REACHED') {
          errorMessage = `최대 ${createResult.error.maxListings}개까지 등록할 수 있습니다.`;
        } else if (createResult.error.type === 'INVALID_PRICE') {
          errorMessage = `최소 가격은 ${createResult.error.minPrice.toLocaleString()}입니다.`;
        }

        await componentInteraction.editReply({
          embeds: [new EmbedBuilder().setColor(0xFF0000).setTitle('❌ 등록 실패').setDescription(errorMessage)],
          components: [],
        });
        collector.stop();
        return;
      }

      const listing = createResult.data.listing;
      const currencyName = listing.currencyType === 'topy' ? topyName : rubyName;
      const feePercent = listing.currencyType === 'topy' ? 5 : 3;

      const successEmbed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('✅ 장터 등록 완료!')
        .addFields(
          { name: '📦 상품명', value: listing.title, inline: false },
          { name: '카테고리', value: CATEGORY_LABELS[listing.category], inline: true },
          { name: '가격', value: `${listing.price.toLocaleString()} ${currencyName}`, inline: true },
          { name: '수수료', value: `${feePercent}% (판매 시 차감)`, inline: true },
          { name: '만료일', value: formatDistanceToNow(listing.expiresAt, { locale: ko, addSuffix: true }), inline: true }
        )
        .setFooter({ text: `상품 ID: #${listing.id}` })
        .setTimestamp();

      await componentInteraction.editReply({ embeds: [successEmbed], components: [] });
      collector.stop();
      return;
    }

    // 미리보기 업데이트
    const currencyName = selectedCurrency ? (selectedCurrency === 'topy' ? topyName : rubyName) : '선택해주세요';
    const categoryLabel = selectedCategory ? CATEGORY_LABELS[selectedCategory] : '선택해주세요';

    const updatedEmbed = new EmbedBuilder()
      .setColor(0xFFA500)
      .setTitle('📝 상품 등록 미리보기')
      .addFields(
        { name: '제목', value: title, inline: false },
        { name: '설명', value: description || '(없음)', inline: false },
        { name: '가격', value: `${price.toLocaleString()} ${selectedCurrency ? currencyName : ''}`, inline: true },
        { name: '카테고리', value: categoryLabel, inline: true },
        { name: '화폐', value: currencyName, inline: true }
      )
      .setFooter({ text: '카테고리와 화폐를 선택한 후 등록하기를 눌러주세요.' });

    const canConfirm = selectedCategory && selectedCurrency;

    await componentInteraction.update({
      embeds: [updatedEmbed],
      components: [
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`market_panel_reg_category_${userId}`)
            .setPlaceholder('카테고리 선택')
            .addOptions(CATEGORY_OPTIONS.filter((opt) => opt.value !== 'all'))
        ),
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`market_panel_reg_currency_${userId}`)
            .setPlaceholder('화폐 선택')
            .addOptions([
              { label: topyName, value: 'topy', emoji: '💰', description: '최소 100' },
              { label: rubyName, value: 'ruby', emoji: '💎', description: '최소 1' },
            ])
        ),
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`market_panel_reg_confirm_${userId}`)
            .setLabel('등록하기')
            .setStyle(ButtonStyle.Success)
            .setDisabled(!canConfirm),
          new ButtonBuilder()
            .setCustomId(`market_panel_reg_cancel_${userId}`)
            .setLabel('취소')
            .setStyle(ButtonStyle.Secondary)
        ),
      ],
    });
  });

  collector.on('end', async (_, reason) => {
    if (reason === 'time') {
      try {
        await interaction.editReply({
          embeds: [new EmbedBuilder().setColor(0x808080).setTitle('⏰ 시간 초과').setDescription('등록 시간이 초과되었습니다.')],
          components: [],
        });
      } catch {
        // 메시지 삭제됨
      }
    }
  });
}

/** 내상품 버튼 핸들러 */
export async function handleMarketPanelMy(
  interaction: ButtonInteraction,
  container: Container
) {
  const guildId = interaction.guildId;
  const userId = interaction.user.id;

  if (!guildId) {
    await interaction.reply({ content: '서버에서만 사용할 수 있습니다.', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  // 화폐 설정 조회
  const settingsResult = await container.currencyService.getSettings(guildId);
  const topyName = (settingsResult.success && settingsResult.data?.topyName) || '토피';
  const rubyName = (settingsResult.success && settingsResult.data?.rubyName) || '루비';

  const listingsResult = await container.marketService.getMyListings(guildId, userId, { limit: 20 });

  if (!listingsResult.success) {
    await interaction.editReply({ content: '상품 목록을 불러오는 중 오류가 발생했습니다.' });
    return;
  }

  const listings = listingsResult.data;

  if (listings.length === 0) {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📦 내 등록 상품')
      .setDescription('등록한 상품이 없습니다.\n\n패널의 **등록하기** 버튼으로 상품을 등록해보세요!')
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('📦 내 등록 상품')
    .setDescription(`총 ${listings.length}개의 상품`)
    .setTimestamp();

  const fields = listings.map((listing, idx) => {
    const currencyName = listing.currencyType === 'topy' ? topyName : rubyName;
    const statusLabel = STATUS_LABELS[listing.status];
    const expiresIn =
      listing.status === 'active'
        ? `만료 ${formatDistanceToNow(listing.expiresAt, { locale: ko, addSuffix: true })}`
        : '';

    let info = `${currencyName} **${listing.price.toLocaleString()}** · ${statusLabel}`;
    if (expiresIn) info += ` · ${expiresIn}`;
    if (listing.buyerId) info += `\n구매자: <@${listing.buyerId}>`;

    return { name: `${idx + 1}. ${listing.title}`, value: info, inline: false };
  });

  embed.addFields(fields);

  const activeListings = listings.filter((l) => l.status === 'active');

  if (activeListings.length > 0) {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`market_panel_my_cancel_${userId}`)
      .setPlaceholder('취소할 상품을 선택하세요')
      .addOptions(
        activeListings.slice(0, 25).map((listing) => ({
          label: listing.title.length > 50 ? listing.title.slice(0, 47) + '...' : listing.title,
          description: `${listing.price.toLocaleString()} ${listing.currencyType === 'topy' ? topyName : rubyName}`,
          value: listing.id.toString(),
          emoji: '❌',
        }))
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
    const response = await interaction.editReply({ embeds: [embed], components: [row] });

    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      filter: (i) => i.user.id === userId && i.customId === `market_panel_my_cancel_${userId}`,
      time: 60000,
    });

    collector.on('collect', async (selectInteraction) => {
      const listingId = BigInt(selectInteraction.values[0]!);

      const cancelResult = await container.marketService.cancelListing(guildId, userId, listingId);

      if (!cancelResult.success) {
        await selectInteraction.reply({ content: '상품 취소 중 오류가 발생했습니다.', ephemeral: true });
        return;
      }

      await selectInteraction.reply({ content: '✅ 상품이 취소되었습니다.', ephemeral: true });
      collector.stop();
    });

    collector.on('end', async () => {
      try {
        await interaction.editReply({ components: [] });
      } catch {
        // 메시지 삭제됨
      }
    });
  } else {
    await interaction.editReply({ embeds: [embed] });
  }
}
