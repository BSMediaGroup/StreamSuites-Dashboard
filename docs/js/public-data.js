(() => {
  const publicClips = [
    {
      id: "rumble-2481",
      title: "Aftershow highlight: Community AMA",
      creator: {
        name: "NovaByte",
        avatar: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=200&q=60",
      },
      platform: "Rumble",
      status: "Published",
      duration: "08:42",
      date: "03/24/2024",
      url: "https://rumble.com/streamsuites",
      thumbnail: null,
      summary: "Post-show Q&A session covering roadmap and feature drops.",
    },
    {
      id: "yt-9921",
      title: "Feature walkthrough: Scoreboards primer",
      creator: {
        name: "Aster",
        avatar: "https://images.unsplash.com/photo-1521119989659-a83eee488004?auto=format&fit=crop&w=200&q=60",
      },
      platform: "YouTube",
      status: "Encoding",
      duration: "05:12",
      date: "03/27/2024",
      url: "https://youtube.com/@StreamSuites",
      thumbnail: "/assets/backgrounds/seodash.jpg",
      summary: "Short primer showing how scoreboard overlays are configured.",
    },
    {
      id: "tw-5577",
      title: "Live capture: Chat replay stress test",
      creator: {
        name: "RelayOps",
        avatar: null,
      },
      platform: "Twitch",
      status: "Pending",
      duration: "12:01",
      date: "04/01/2024",
      url: "https://twitch.tv",
      thumbnail: null,
      summary: "Load testing chat replay capture for cross-posting.",
    },
    {
      id: "rumble-3180",
      title: "Creator onboarding: Clips pipeline",
      creator: {
        name: "StreamLabs",
        avatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=200&q=60",
      },
      platform: "Rumble",
      status: "Published",
      duration: "03:48",
      date: "03/29/2024",
      url: "https://rumble.com/streamsuites",
      thumbnail: "/assets/logos/LOG2-3D-SML.png",
      summary: "Quick-start overview for routing creator clips into the hub.",
    },
    {
      id: "ss-4412",
      title: "Platform badge routing demo",
      creator: {
        name: "Internal QA",
        avatar: null,
      },
      platform: "Twitter",
      status: "Published",
      duration: "02:16",
      date: "03/18/2024",
      url: "https://twitter.com",
      thumbnail: null,
      summary: "Verification pass showing per-platform badge routing in the UI.",
    },
    {
      id: "yt-0044",
      title: "Studio feed: Lighting adjustments",
      creator: {
        name: "NovaByte",
        avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=200&q=60",
      },
      platform: "YouTube",
      status: "Encoding",
      duration: "09:34",
      date: "04/02/2024",
      url: "https://youtube.com/@StreamSuites",
      thumbnail: null,
      summary: "Studio-only pass for the latest lighting trims before rollout.",
    },
    {
      id: "rumble-9011",
      title: "Creator spotlight: Weekend recap",
      creator: {
        name: "Harbor",
        avatar: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=200&q=60",
      },
      platform: "Rumble",
      status: "Published",
      duration: "04:55",
      date: "03/30/2024",
      url: "https://rumble.com/streamsuites",
      thumbnail: null,
      summary: "Weekend wrap with community highlights and new channel tests.",
    },
    {
      id: "ss-7718",
      title: "Pipeline health: placeholder ingest",
      creator: {
        name: "RelayOps",
        avatar: null,
      },
      platform: "Generic",
      status: "Pending",
      duration: "06:03",
      date: "04/05/2024",
      url: "https://example.com",
      thumbnail: null,
      summary: "Smoke test clip to validate ingest queue monitoring hooks.",
    },
  ];

  const publicPolls = [
    {
      id: "poll-2301",
      question: "Which creator should premiere next on the main channel?",
      creator: {
        name: "NovaByte",
        avatar: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=120&q=60",
      },
      status: "Open",
      timestamp: "Updated 2h ago",
      createdAt: "03/22/2024",
      updatedAt: "03/24/2024",
      closesAt: "03/29/2024",
      options: [
        { label: "Rumble exclusive", percent: 46, votes: 920 },
        { label: "Simulcast to YouTube", percent: 38, votes: 760 },
        { label: "Clip-only release", percent: 16, votes: 320 },
      ],
      summary: "Community pick for the next featured creator premiere on the flagship channel.",
    },
    {
      id: "poll-2302",
      question: "Pick the next chat trigger pack to ship.",
      creator: {
        name: "RelayOps",
        avatar: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=120&q=60",
      },
      status: "Closed",
      timestamp: "Closed 1d ago",
      createdAt: "03/19/2024",
      updatedAt: "03/23/2024",
      closesAt: "03/23/2024",
      options: [
        { label: "Hype + Alerts", percent: 52, votes: 1040 },
        { label: "Supporter CTAs", percent: 31, votes: 620 },
        { label: "Emote Storm", percent: 17, votes: 340 },
      ],
      summary: "Next pack of chat-triggered interactions to batch into the release train.",
    },
    {
      id: "poll-2303",
      question: "What kind of scoreboard do you want next week?",
      creator: {
        name: "Harbor",
        avatar: "https://images.unsplash.com/photo-1502685104226-ee32379fefbe?auto=format&fit=crop&w=120&q=60",
      },
      status: "Open",
      timestamp: "Updated 4h ago",
      createdAt: "03/25/2024",
      updatedAt: "03/26/2024",
      closesAt: "03/31/2024",
      options: [
        { label: "Creator vs Creator", percent: 44, votes: 880 },
        { label: "Chat milestones", percent: 41, votes: 820 },
        { label: "Platform ladder", percent: 15, votes: 300 },
      ],
      summary: "Decide which scoreboard format gets showcased on next week's livestream.",
    },
    {
      id: "poll-2304",
      question: "Select the format for polls recap streams.",
      creator: {
        name: "Internal QA",
        avatar: null,
      },
      status: "Pending",
      timestamp: "Queued",
      createdAt: "03/28/2024",
      updatedAt: "03/28/2024",
      closesAt: "04/03/2024",
      options: [
        { label: "Weekly rollup", percent: 0, votes: 0 },
        { label: "Creator highlights", percent: 0, votes: 0 },
        { label: "Rapid-fire Q&A", percent: 0, votes: 0 },
      ],
      summary: "Pick the recap stream format for sharing poll results back to creators.",
    },
    {
      id: "poll-2305",
      question: "Which overlays should get the next pie-chart rollout?",
      creator: {
        name: "NovaByte",
        avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=120&q=60",
      },
      status: "Open",
      timestamp: "Updated 3h ago",
      createdAt: "03/30/2024",
      updatedAt: "03/30/2024",
      closesAt: "04/04/2024",
      chartType: "pie",
      options: [
        { label: "Channel recap", percent: 48, votes: 960, color: "#8cc736" },
        { label: "Hype countdown", percent: 32, votes: 640, color: "#ffae00" },
        { label: "Sponsor slots", percent: 20, votes: 400, color: "#5bc0de" },
      ],
      summary: "Previewing pie-chart overlays; choose which template gets the first deployment.",
    },
    {
      id: "poll-2306",
      question: "Select the pie-style telemetry bundle for match day.",
      creator: {
        name: "RelayOps",
        avatar: "https://images.unsplash.com/photo-1502685104226-ee32379fefbe?auto=format&fit=crop&w=120&q=60",
      },
      status: "Pending",
      timestamp: "Queued",
      createdAt: "03/31/2024",
      updatedAt: "03/31/2024",
      closesAt: "04/06/2024",
      chartType: "pie",
      options: [
        { label: "Player stats", percent: 0, votes: 0, color: "#6ce1ff" },
        { label: "Region split", percent: 0, votes: 0, color: "#9fed4a" },
        { label: "Engagement mix", percent: 0, votes: 0, color: "#f7c14b" },
      ],
      summary: "Queued pie-style telemetry bundle to pair with scoreboards on match day.",
    },
  ];

  const publicTallies = [
    {
      id: "tally-4101",
      title: "Weekly chat triggers (top performers)",
      creator: {
        name: "RelayOps",
        avatar: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=120&q=60",
      },
      status: "Active",
      window: "Week of 04/01",
      scope: "Programmatic aggregation",
      updatedAt: "04/06/2024",
      entries: [
        { label: "Hype triggers", percent: 48, count: 1420, color: "#8cc736" },
        { label: "Supporter CTAs", percent: 34, count: 1000, color: "#ffae00" },
        { label: "Clip requests", percent: 18, count: 540, color: "#5bc0de" },
      ],
      summary: "Chat-driven trigger activity tallied across the network for the current week.",
    },
    {
      id: "tally-4102",
      title: "Monthly platform engagement split",
      creator: {
        name: "NovaByte",
        avatar: "https://images.unsplash.com/photo-1502685104226-ee32379fefbe?auto=format&fit=crop&w=120&q=60",
      },
      status: "Closed",
      window: "March 2024",
      scope: "Monthly aggregation",
      updatedAt: "03/31/2024",
      entries: [
        { label: "Rumble engagement", percent: 44, count: 880, color: "#7e03aa" },
        { label: "YouTube engagement", percent: 37, count: 740, color: "#5bc0de" },
        { label: "Twitch engagement", percent: 19, count: 380, color: "#ffae00" },
      ],
      summary: "Month-end engagement tallies across primary platforms.",
    },
    {
      id: "tally-4103",
      title: "Custom event tally (campaign sprint)",
      creator: {
        name: "Internal QA",
        avatar: null,
      },
      status: "Pending",
      window: "Custom window",
      scope: "Campaign aggregation",
      updatedAt: "Queued",
      entries: [
        { label: "Overlay activations", percent: 0, count: 0, color: "#6ce1ff" },
        { label: "Chat milestones", percent: 0, count: 0, color: "#9fed4a" },
        { label: "Scoreboard boosts", percent: 0, count: 0, color: "#f7c14b" },
      ],
      summary: "Upcoming sprint tally for campaign-specific triggers and overlays.",
    },
  ];

  window.publicClips = publicClips;
  window.publicClipMap = publicClips.reduce((acc, clip) => {
    acc[clip.id] = clip;
    return acc;
  }, {});

  window.publicPolls = publicPolls;
  window.publicPollMap = publicPolls.reduce((acc, poll) => {
    acc[poll.id] = poll;
    return acc;
  }, {});

  window.publicTallies = publicTallies;
  window.publicTallyMap = publicTallies.reduce((acc, tally) => {
    acc[tally.id] = tally;
    return acc;
  }, {});
})();
