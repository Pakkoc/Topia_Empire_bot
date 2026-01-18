import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  GuildMember,
} from 'discord.js';
import type { TreasuryTransaction } from '@topia/core';
import type { Command } from './types';

export const treasuryCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('국고')
    .setDescription('서버 국고를 관리합니다')
    .addSubcommand(sub =>
      sub
        .setName('조회')
        .setDescription('국고 현황을 조회합니다')
    )
    .addSubcommand(sub =>
      sub
        .setName('지급')
        .setDescription('국고에서 유저에게 화폐를 지급합니다')
        .addUserOption(option =>
          option
            .setName('유저')
            .setDescription('지급받을 유저')
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option
            .setName('금액')
            .setDescription('지급할 금액')
            .setRequired(true)
            .setMinValue(1)
        )
        .addStringOption(option =>
          option
            .setName('화폐')
            .setDescription('지급할 화폐 종류')
            .setRequired(true)
            .addChoices(
              { name: '토피', value: 'topy' },
              { name: '루비', value: 'ruby' }
            )
        )
        .addStringOption(option =>
          option
            .setName('사유')
            .setDescription('지급 사유')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('대량지급')
        .setDescription('국고에서 특정 역할의 모든 유저에게 화폐를 지급합니다')
        .addRoleOption(option =>
          option
            .setName('역할')
            .setDescription('지급받을 역할')
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option
            .setName('금액')
            .setDescription('1인당 지급할 금액')
            .setRequired(true)
            .setMinValue(1)
        )
        .addStringOption(option =>
          option
            .setName('화폐')
            .setDescription('지급할 화폐 종류')
            .setRequired(true)
            .addChoices(
              { name: '토피', value: 'topy' },
              { name: '루비', value: 'ruby' }
            )
        )
        .addStringOption(option =>
          option
            .setName('사유')
            .setDescription('지급 사유')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('내역')
        .setDescription('국고 거래 내역을 조회합니다')
        .addIntegerOption(option =>
          option
            .setName('페이지')
            .setDescription('페이지 번호')
            .setRequired(false)
            .setMinValue(1)
        )
    ),

  async execute(interaction, container) {
    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply({
        content: '서버에서만 사용할 수 있습니다.',
        ephemeral: true,
      });
      return;
    }

    // 화폐 설정 조회
    const settingsResult = await container.currencyService.getSettings(guildId);
    const settings = settingsResult.success ? settingsResult.data : null;
    const topyName = settings?.topyName || '토피';
    const rubyName = settings?.rubyName || '루비';
    const logChannelId = settings?.currencyLogChannelId;
    const treasuryManagerRoleId = settings?.treasuryManagerRoleId;

    // 권한 체크: 관리자 권한 또는 국고 관리자 역할
    const member = interaction.member as GuildMember;
    const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
    const hasTreasuryRole = treasuryManagerRoleId && member.roles.cache.has(treasuryManagerRoleId);

    if (!isAdmin && !hasTreasuryRole) {
      const errorPanel = new ContainerBuilder()
        .setAccentColor(0xff0000)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('# ⛔ 권한 없음')
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            '이 명령어를 사용할 권한이 없습니다.\n\n' +
            '**필요 조건:**\n' +
            '• 서버 관리자 권한\n' +
            (treasuryManagerRoleId ? `• 또는 <@&${treasuryManagerRoleId}> 역할` : '• 또는 국고 관리자 역할 (설정 필요)')
          )
        );

      await interaction.reply({
        components: [errorPanel.toJSON()],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === '조회') {
      await handleView(interaction, container, topyName, rubyName);
    } else if (subcommand === '지급') {
      await handleDistribute(interaction, container, topyName, rubyName, logChannelId);
    } else if (subcommand === '대량지급') {
      await handleBulkDistribute(interaction, container, topyName, rubyName, logChannelId);
    } else if (subcommand === '내역') {
      await handleHistory(interaction, container, topyName, rubyName);
    }
  },
};

async function handleView(
  interaction: any,
  container: any,
  topyName: string,
  rubyName: string
) {
  const guildId = interaction.guildId!;

  const treasuryResult = await container.treasuryService.getTreasury(guildId);
  if (!treasuryResult.success) {
    await interaction.reply({
      content: '국고 정보를 조회하는 중 오류가 발생했습니다.',
      ephemeral: true,
    });
    return;
  }

  const treasury = treasuryResult.data;
  const monthlyResult = await container.treasuryService.getMonthlyCollected(guildId);
  const monthly = monthlyResult.success ? monthlyResult.data : { topy: BigInt(0), ruby: BigInt(0) };

  const panel = new ContainerBuilder()
    .setAccentColor(0x2ecc71)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('# 🏦 국고 현황')
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**잔액**\n` +
        `   • ${topyName}: **${treasury.topyBalance.toLocaleString()}**\n` +
        `   • ${rubyName}: **${treasury.rubyBalance.toLocaleString()}**`
      )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**이번 달 수집**\n` +
        `   • ${topyName}: +${monthly.topy.toLocaleString()}\n` +
        `   • ${rubyName}: +${monthly.ruby.toLocaleString()}`
      )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `-# 누적 수집: ${topyName} ${treasury.totalTopyCollected.toLocaleString()} / ${rubyName} ${treasury.totalRubyCollected.toLocaleString()}\n` +
        `-# 누적 지급: ${topyName} ${treasury.totalTopyDistributed.toLocaleString()} / ${rubyName} ${treasury.totalRubyDistributed.toLocaleString()}`
      )
    );

  await interaction.reply({
    components: [panel.toJSON()],
    flags: MessageFlags.IsComponentsV2,
  });
}

async function handleDistribute(
  interaction: any,
  container: any,
  topyName: string,
  rubyName: string,
  logChannelId: string | null | undefined
) {
  const guildId = interaction.guildId!;
  const targetUser = interaction.options.getUser('유저', true);
  const amount = interaction.options.getInteger('금액', true);
  const currencyType = interaction.options.getString('화폐', true) as 'topy' | 'ruby';
  const reason = interaction.options.getString('사유');
  const currencyName = currencyType === 'topy' ? topyName : rubyName;

  await interaction.deferReply({ ephemeral: true });

  // 국고에서 지급
  const distributeResult = await container.treasuryService.distribute(
    guildId,
    currencyType,
    BigInt(amount),
    targetUser.id,
    reason ?? undefined
  );

  if (!distributeResult.success) {
    let errorMessage = '지급 중 오류가 발생했습니다.';
    if (distributeResult.error.type === 'INSUFFICIENT_BALANCE') {
      errorMessage = `국고 잔액이 부족합니다.\n필요: ${distributeResult.error.required.toLocaleString()} ${currencyName}\n보유: ${distributeResult.error.available.toLocaleString()} ${currencyName}`;
    }

    const errorPanel = new ContainerBuilder()
      .setAccentColor(0xff0000)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('# ❌ 지급 실패')
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(errorMessage)
      );

    await interaction.editReply({
      components: [errorPanel.toJSON()],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }

  // 유저 지갑에 추가
  if (currencyType === 'topy') {
    await container.currencyService.grantCurrency(guildId, targetUser.id, amount, 'topy');
  } else {
    await container.currencyService.grantCurrency(guildId, targetUser.id, amount, 'ruby');
  }

  const successPanel = new ContainerBuilder()
    .setAccentColor(0x2ecc71)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('# ✅ 지급 완료')
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**${targetUser.displayName}**님에게 **${amount.toLocaleString()} ${currencyName}**를 지급했습니다.` +
        (reason ? `\n📝 사유: ${reason}` : '')
      )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `-# 국고 잔액: ${currencyType === 'topy'
          ? distributeResult.data.treasury.topyBalance.toLocaleString()
          : distributeResult.data.treasury.rubyBalance.toLocaleString()
        } ${currencyName}`
      )
    );

  await interaction.editReply({
    components: [successPanel.toJSON()],
    flags: MessageFlags.IsComponentsV2,
  });

  // 로그 채널에 기록
  if (logChannelId) {
    const logChannel = await interaction.guild?.channels.fetch(logChannelId).catch(() => null);
    if (logChannel?.isTextBased()) {
      const logPanel = new ContainerBuilder()
        .setAccentColor(0x2ecc71)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('# 🏦 국고 지급')
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `<@${interaction.user.id}>님이 <@${targetUser.id}>님에게\n` +
            `**${amount.toLocaleString()} ${currencyName}**를 국고에서 지급했습니다.` +
            (reason ? `\n📝 사유: ${reason}` : '')
          )
        );

      await logChannel.send({
        components: [logPanel.toJSON()],
        flags: MessageFlags.IsComponentsV2,
      });
    }
  }
}

async function handleBulkDistribute(
  interaction: any,
  container: any,
  topyName: string,
  rubyName: string,
  logChannelId: string | null | undefined
) {
  const guildId = interaction.guildId!;
  const targetRole = interaction.options.getRole('역할', true);
  const amountPerUser = interaction.options.getInteger('금액', true);
  const currencyType = interaction.options.getString('화폐', true) as 'topy' | 'ruby';
  const reason = interaction.options.getString('사유');
  const currencyName = currencyType === 'topy' ? topyName : rubyName;

  await interaction.deferReply({ ephemeral: true });

  // 역할 멤버 조회
  const members = await interaction.guild?.members.fetch();
  const targetMembers = members?.filter((m: any) =>
    m.roles.cache.has(targetRole.id) && !m.user.bot
  );

  if (!targetMembers || targetMembers.size === 0) {
    const errorPanel = new ContainerBuilder()
      .setAccentColor(0xff0000)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('# ❌ 지급 실패')
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('해당 역할을 가진 유저가 없습니다.')
      );

    await interaction.editReply({
      components: [errorPanel.toJSON()],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }

  const totalAmount = BigInt(amountPerUser) * BigInt(targetMembers.size);

  // 국고 잔액 확인
  const treasuryResult = await container.treasuryService.getTreasury(guildId);
  if (!treasuryResult.success) {
    await interaction.editReply({
      content: '국고 정보를 조회하는 중 오류가 발생했습니다.',
    });
    return;
  }

  const currentBalance = currencyType === 'topy'
    ? treasuryResult.data.topyBalance
    : treasuryResult.data.rubyBalance;

  if (currentBalance < totalAmount) {
    const errorPanel = new ContainerBuilder()
      .setAccentColor(0xff0000)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('# ❌ 지급 실패')
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `국고 잔액이 부족합니다.\n` +
          `필요: ${totalAmount.toLocaleString()} ${currencyName} (${amountPerUser.toLocaleString()} × ${targetMembers.size}명)\n` +
          `보유: ${currentBalance.toLocaleString()} ${currencyName}`
        )
      );

    await interaction.editReply({
      components: [errorPanel.toJSON()],
      flags: MessageFlags.IsComponentsV2,
    });
    return;
  }

  // 국고에서 차감
  const distributeResult = await container.treasuryService.distribute(
    guildId,
    currencyType,
    totalAmount,
    interaction.user.id, // 대량지급 실행자
    `대량지급: ${targetRole.name} (${targetMembers.size}명)` + (reason ? ` - ${reason}` : '')
  );

  if (!distributeResult.success) {
    await interaction.editReply({
      content: '국고 차감 중 오류가 발생했습니다.',
    });
    return;
  }

  // 각 유저에게 지급
  let successCount = 0;
  for (const [, member] of targetMembers) {
    try {
      await container.currencyService.grantCurrency(guildId, member.id, amountPerUser, currencyType);
      successCount++;
    } catch {
      // 개별 실패는 무시
    }
  }

  const successPanel = new ContainerBuilder()
    .setAccentColor(0x2ecc71)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('# ✅ 대량 지급 완료')
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**${targetRole.name}** 역할 **${successCount}명**에게\n` +
        `1인당 **${amountPerUser.toLocaleString()} ${currencyName}**를 지급했습니다.\n` +
        `총 지급액: **${totalAmount.toLocaleString()} ${currencyName}**` +
        (reason ? `\n📝 사유: ${reason}` : '')
      )
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `-# 국고 잔액: ${currencyType === 'topy'
          ? distributeResult.data.treasury.topyBalance.toLocaleString()
          : distributeResult.data.treasury.rubyBalance.toLocaleString()
        } ${currencyName}`
      )
    );

  await interaction.editReply({
    components: [successPanel.toJSON()],
    flags: MessageFlags.IsComponentsV2,
  });

  // 로그 채널에 기록
  if (logChannelId) {
    const logChannel = await interaction.guild?.channels.fetch(logChannelId).catch(() => null);
    if (logChannel?.isTextBased()) {
      const logPanel = new ContainerBuilder()
        .setAccentColor(0x2ecc71)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('# 🏦 국고 대량 지급')
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `<@${interaction.user.id}>님이 **${targetRole.name}** 역할 ${successCount}명에게\n` +
            `총 **${totalAmount.toLocaleString()} ${currencyName}**를 국고에서 지급했습니다.` +
            (reason ? `\n📝 사유: ${reason}` : '')
          )
        );

      await logChannel.send({
        components: [logPanel.toJSON()],
        flags: MessageFlags.IsComponentsV2,
      });
    }
  }
}

async function handleHistory(
  interaction: any,
  container: any,
  topyName: string,
  rubyName: string
) {
  const guildId = interaction.guildId!;
  const page = interaction.options.getInteger('페이지') ?? 1;
  const limit = 10;
  const offset = (page - 1) * limit;

  const result = await container.treasuryService.getTransactions(guildId, { limit, offset });
  if (!result.success) {
    await interaction.reply({
      content: '거래 내역을 조회하는 중 오류가 발생했습니다.',
      ephemeral: true,
    });
    return;
  }

  const { transactions, total } = result.data;
  const totalPages = Math.ceil(total / limit);

  if (transactions.length === 0) {
    const emptyPanel = new ContainerBuilder()
      .setAccentColor(0x95a5a6)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('# 📜 국고 거래 내역')
      )
      .addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
      )
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('거래 내역이 없습니다.')
      );

    await interaction.reply({
      components: [emptyPanel.toJSON()],
      flags: MessageFlags.IsComponentsV2,
      ephemeral: true,
    });
    return;
  }

  const typeLabels: Record<string, string> = {
    transfer_fee: '이체 수수료',
    shop_fee: '상점 수수료',
    tax: '세금',
    admin_distribute: '관리자 지급',
  };

  const historyLines = transactions.map((tx: TreasuryTransaction) => {
    const currencyName = tx.currencyType === 'topy' ? topyName : rubyName;
    const typeLabel = typeLabels[tx.transactionType] || tx.transactionType;
    const sign = tx.transactionType === 'admin_distribute' ? '-' : '+';
    const date = new Date(tx.createdAt).toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${sign}${tx.amount.toLocaleString()} ${currencyName} • ${typeLabel} • ${date}`;
  });

  const panel = new ContainerBuilder()
    .setAccentColor(0x3498db)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('# 📜 국고 거래 내역')
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(historyLines.join('\n'))
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# 페이지 ${page} / ${totalPages} (총 ${total}건)`)
    );

  await interaction.reply({
    components: [panel.toJSON()],
    flags: MessageFlags.IsComponentsV2,
    ephemeral: true,
  });
}
