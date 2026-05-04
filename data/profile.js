/**
 * profile.js — Single source of truth for Ravi Rachakonda's profile data.
 * Used by both terminal.js and chat.js. Update here, reflects everywhere.
 */

const PROFILE = {
  name: "Ravi Rachakonda",
  title: "Staff Machine Learning Engineer",
  email: "ravikiran2508@gmail.com",
  phone: "+1 (904) 610-0261",
  linkedin: "https://linkedin.com/in/ravi-rachakonda-91a56024",
  github: "https://github.com/ravikiranrachakonda",
  website: "https://ravikiranrachakonda.github.io",

  summary: `Staff Machine Learning Engineer with 17+ years defining org-wide architecture
and technical strategy across multimodal foundation models, distributed training, and MLOps.
Led multi-team initiatives spanning 4+ orgs and 100+ engineers. Founding engineer on Amazon
Alexa; key technical leader for Amazon Nova foundation models now serving enterprise customers
on Amazon Bedrock. Co-inventor on 3 granted US patents.`,

  experience: [
    {
      id: 1,
      title: "Senior Machine Learning Engineer, AGI Data Scaling",
      company: "Amazon AGI",
      period: "Jan 2026 – Present",
      location: "Sunnyvale, CA",
      summary: "Cross-org tech lead setting data infrastructure strategy for Amazon Nova foundation models and the Nova Forge platform.",
      bullets: [
        "Defined the data preparation architecture within Nova Forge SDK for foundation model customization — driving adoption across internal and enterprise teams.",
        "Set technical direction for ensuring training data integrity for Amazon Nova foundation models, defining processes now standardized across the org.",
        "Leading strategic migration of customers from manual data prep workflows to Nova Forge's managed platform.",
        "Driving integration of production-grade data quality filters into the customer-facing SDK.",
        "Serving as technical bridge between enterprise customers and internal platform teams.",
      ],
      tags: ["Nova Forge SDK", "Ray on HyperPod", "Foundation Models", "Data Infrastructure"],
    },
    {
      id: 2,
      title: "Senior Research Engineer, Nova Pre & Post Training",
      company: "Amazon AGI",
      period: "2024 – Jan 2026",
      location: "Sunnyvale, CA",
      summary: "Cross-org technical lead across pre-training, data infrastructure, and evaluations orgs for Amazon Nova.",
      bullets: [
        "Led org-wide multimodal (vision) pre-training strategy — defined training protocols adopted org-wide.",
        "Standardized evaluation framework for vision-language models across the org.",
        "Drove org-wide adoption of NVIDIA NeMo 2.0, MegatronCore, and MegatronEnergon without direct authority.",
        "Reduced training cluster MTTR by 13x (40 min → 3 min) by redesigning Energon dataloader.",
        "Built scalable embedding generation pipeline enabling petabyte-scale multimodal data ingestion.",
        "Designed real-time Avatar demo at AWS re:Invent 2024 using NVIDIA Triton Inference Server.",
      ],
      tags: ["NeMo 2.0", "MegatronCore", "Multimodal LLMs", "Diffusion Transformers", "Triton Inference"],
    },
    {
      id: 3,
      title: "Senior Software Engineer / Tech Lead, FireTV Background & Creative AI",
      company: "Amazon",
      period: "2022 – 2024",
      location: "Sunnyvale, CA",
      summary: "Founded and led the Image Generation initiative across two org boundaries (Alexa AI + FireTV).",
      bullets: [
        "Founded Image Generation initiative — shipped voice-driven background generation to millions of FireTV devices.",
        "Delivered the model productized as Amazon Bedrock's Titan Image Generation (Nova) — 1M+ images/month in production.",
        "Defined end-to-end MLOps pipeline (CodeCommit, ECR, S3, SageMaker) with fully automated CI/CD.",
        "Founded Creative AI for Amazon Kids — ranked top 3 among all Amazon Kids Alexa skills at launch.",
      ],
      tags: ["Image Generation", "Amazon Bedrock", "SageMaker", "MLOps", "CI/CD"],
    },
    {
      id: 4,
      title: "Senior Software Engineer / Tech Lead, Alexa Astro",
      company: "Amazon Lab126",
      period: "2018 – 2021",
      location: "Sunnyvale, CA",
      summary: "Founded and led the Personality program for Amazon Astro — Amazon's first consumer home robot.",
      bullets: [
        "Defined technical vision for expressive robot behavior; shipped to initial customers.",
        "Set architecture patterns adopted across the entire Astro org.",
      ],
      tags: ["Robotics", "Personality AI", "0→1"],
    },
    {
      id: 5,
      title: "Software Development Engineer / Tech Lead, Alexa Platform",
      company: "Amazon Lab126",
      period: "Sep 2012 – Aug 2018",
      location: "United States",
      summary: "Founding engineer on Amazon Alexa — one of the earliest engineers on the platform.",
      bullets: [
        "Tech lead for Echo Spatial Perception, Notifications, Movies & Showtimes, Local Search, Sports Q&A.",
        "Scaled Alexa platform to 10,000+ TPS at 99.9% availability for millions of users worldwide.",
        "Co-authored 3 granted US patents including Echo Spatial Perception.",
      ],
      tags: ["Alexa", "Voice AI", "Distributed Systems", "Patents"],
    },
    {
      id: 6,
      title: "Software Development Engineer",
      company: "Amazon.com",
      period: "Jul 2009 – Aug 2012",
      location: "Bangalore, India",
      summary: "Built core Amazon Prime infrastructure and contributed to international launches.",
      bullets: [
        "Built and maintained the Amazon Prime data processing pipeline.",
        "Contributed to Prime launches in Spain and Germany.",
      ],
      tags: ["Amazon Prime", "Data Pipelines"],
    },
  ],

  skills: {
    "ML & AI": ["PyTorch", "NVIDIA NeMo 2.0", "MegatronCore", "MegatronLM", "MegatronEnergon", "Triton Inference Server", "Diffusion Transformers", "Multimodal LLMs"],
    "Distributed & MLOps": ["Ray", "Apache Spark", "SageMaker HyperPod", "AWS Batch", "Distributed Training", "Fault-Tolerant Pipelines"],
    "Cloud & Infrastructure": ["SageMaker", "ECR", "S3", "Lambda", "DynamoDB", "EC2", "CloudWatch", "CI/CD"],
    "Languages": ["Python", "Java", "JavaScript", "C++", "Shell"],
    "Frameworks": ["FastAPI", "React", "Jupyter", "Alexa Skills Kit"],
  },

  patents: [
    { number: "#10546583", title: "Context-Based Device Arbitration", date: "March 2022" },
    { number: "#11289087", title: "Context-Based Device Arbitration", date: "March 2022" },
    { number: "#10685669", title: "Device Selection from Audio Data", date: "June 2020" },
  ],

  education: {
    degree: "Bachelor of Technology, Information Technology",
    school: "Indian Institute of Information Technology, Prayagraj, India",
    years: "2003 – 2007",
  },
};

// Export for use in terminal.js, chat.js
if (typeof module !== "undefined") module.exports = PROFILE;
