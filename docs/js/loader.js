/**
 * WCAI -- Windchill Config AI -- Config Loader & Serializer
 * =========================================================
 * Port of wc_config/loader.py to JavaScript.
 * Uses js-yaml (loaded via CDN) for YAML parsing/dumping.
 * Attached to window.WCAI.loader.
 */
(function () {
  "use strict";

  var WCAI = window.WCAI = window.WCAI || {};
  var m = WCAI.model;

  // ===================================================================
  // Default config (mirrors Python get_default_config)
  // ===================================================================

  function getDefaultConfig() {
    var roles = {};
    for (var rk in m.ROLES) {
      roles[rk] = [];
    }

    var prefs = {};
    for (var pk in m.PREFERENCES) {
      prefs[pk] = m.PREFERENCES[pk].default;
    }

    var assocs = {};
    for (var ak in m.ASSOCIATION_TYPES) {
      var at = m.ASSOCIATION_TYPES[ak];
      assocs[ak] = {
        enabled: at.standard,
        cardinality: "many:1",
        owning_role: "none",
        required_role: "none",
      };
    }

    return {
      company: {
        name: "",
        org: "",
        site: "",
        context_level: "organization",
        lock_preferences: true,
        use_flexible_change: true,
      },
      groups: [],
      people: [],
      roles: roles,
      preferences: prefs,
      associations: assocs,
      business_rules: { rule_set_name: "", rules: [] },
      custom_attributes: [],
    };
  }

  // ===================================================================
  // Normalize raw YAML object (mirrors Python _normalize)
  // ===================================================================

  function normalize(raw) {
    if (!raw) throw new Error("Config is empty");
    var config = {};

    // --- Company ---
    var company = raw.company || {};
    config.company = {
      name: company.name || "",
      org: company.org || "",
      site: company.site || "",
      context_level: company.context_level || "organization",
      lock_preferences: company.lock_preferences !== false,
      use_flexible_change: company.use_flexible_change !== false,
    };

    // --- Groups ---
    config.groups = [];
    var rawGroups = raw.groups || [];
    for (var gi = 0; gi < rawGroups.length; gi++) {
      var g = rawGroups[gi];
      config.groups.push({
        id: g.id || "",
        name: g.name || "",
        description: g.description || "",
      });
    }

    // --- People ---
    config.people = [];
    var rawPeople = raw.people || [];
    for (var pi = 0; pi < rawPeople.length; pi++) {
      var p = rawPeople[pi];
      config.people.push({
        id: p.id || "",
        name: p.name || "",
        username: p.username || "",
        email: p.email || "",
        group: p.group || "",
      });
    }

    // --- Roles ---
    config.roles = {};
    var rawRoles = raw.roles || {};
    for (var rk in m.ROLES) {
      var assigned = rawRoles[rk] || [];
      if (typeof assigned === "string") assigned = [assigned];
      config.roles[rk] = assigned;
    }

    // --- Preferences ---
    config.preferences = {};
    var rawPrefs = raw.preferences || {};
    for (var pk in m.PREFERENCES) {
      var val = rawPrefs[pk] !== undefined ? rawPrefs[pk] : m.PREFERENCES[pk].default;
      config.preferences[pk] = String(val);
    }

    // --- Associations ---
    config.associations = {};
    var rawAssoc = raw.associations || {};
    for (var ak in m.ASSOCIATION_TYPES) {
      var at = m.ASSOCIATION_TYPES[ak];
      var ua = rawAssoc[ak] || {};
      config.associations[ak] = {
        enabled: ua.enabled !== undefined ? ua.enabled : at.standard,
        cardinality: ua.cardinality || "many:1",
        owning_role: ua.owning_role || "none",
        required_role: ua.required_role || "none",
      };
    }

    // --- Business Rules ---
    var rawRules = raw.business_rules || {};
    var companyPrefix = (config.company.name || "COMPANY").replace(/ /g, "_").toUpperCase();
    config.business_rules = {
      rule_set_name: rawRules.rule_set_name || companyPrefix + "_PRE_RELEASE",
      rules: rawRules.rules || [
        { key: companyPrefix + "_CHECKOUT_RULE", selector: "CHECKOUT_RULE", description: "Fails if changeable is checked out", block_number: 1 },
        { key: companyPrefix + "_RELEASE_TARGET_RULE", selector: "RELEASE_TARGET_RULE", description: "Validates change transition", block_number: 10 },
      ],
    };

    // --- Custom Attributes ---
    config.custom_attributes = raw.custom_attributes || [];

    return config;
  }

  // ===================================================================
  // Parse YAML string into normalized config
  // ===================================================================

  function parseYaml(yamlStr) {
    var raw = jsyaml.load(yamlStr);
    return normalize(raw);
  }

  // ===================================================================
  // Serialize config to YAML string
  // ===================================================================

  function toYaml(config) {
    // Remove internal keys before serializing
    var output = {};
    for (var k in config) {
      if (k.charAt(0) !== "_") {
        output[k] = config[k];
      }
    }

    var header =
      "# ===================================================================\n" +
      "# WCAI -- Windchill Config AI -- Company Configuration\n" +
      "# Company: " + (config.company ? config.company.name : "") + "\n" +
      "# Generated by: WCAI web wizard\n" +
      "# ===================================================================\n\n";

    return header + jsyaml.dump(output, { sortKeys: false, lineWidth: -1 });
  }

  // Export
  WCAI.loader = {
    getDefaultConfig: getDefaultConfig,
    normalize: normalize,
    parseYaml: parseYaml,
    toYaml: toYaml,
  };
})();
